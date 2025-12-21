# ERC-4337 Gasless Sweep Deployment Guide

## Overview
This guide explains how to deploy and configure the Account Abstraction (ERC-4337) gasless sweep system for FinMo. With this system, users can deposit USDC without needing gas tokens (MATIC), as all transaction fees are sponsored by the master wallet through a Paymaster.

## Prerequisites

- Alchemy account (for Gas Manager and Bundler)
- Hardhat or Foundry for smart contract deployment
- Master wallet with sufficient MATIC for initial deployments

## Step 1: Deploy SimpleAccountFactory Contract

### 1.1 Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers@6
npm install @alchemy/aa-core @alchemy/aa-accounts @alchemy/aa-alchemy
```

### 1.2 Create Hardhat Project

```bash
npx hardhat init
```

### 1.3 Deploy Script

Create `scripts/deploy-aa-factory.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // EntryPoint v0.6 (standard ERC-4337 address)
  const ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  // Deploy SimpleAccountFactory
  const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
  const factory = await SimpleAccountFactory.deploy(ENTRYPOINT);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("✅ SimpleAccountFactory deployed to:", factoryAddress);
  console.log("✅ EntryPoint:", ENTRYPOINT);
  console.log("\n📝 Add these to Supabase secrets:");
  console.log(`AA_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`AA_ENTRYPOINT_ADDRESS=${ENTRYPOINT}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 1.4 Hardhat Config

Update `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.MASTER_WALLET_PRIVATE_KEY],
      chainId: 80002
    }
  }
};
```

### 1.5 Deploy

```bash
npx hardhat run scripts/deploy-aa-factory.js --network polygonAmoy
```

**Save the factory address for the next steps!**

## Step 2: Setup Alchemy Account Abstraction

### 2.1 Create Alchemy Account
1. Go to https://dashboard.alchemy.com
2. Create a new app on **Polygon Amoy** testnet
3. Enable "Account Abstraction" features

### 2.2 Setup Gas Manager
1. Navigate to "Gas Manager" in the Alchemy dashboard
2. Click "Create Policy"
3. Configure policy:
   ```json
   {
     "name": "FinMo Gasless Sweeps",
     "chain": "Polygon Amoy",
     "rules": {
       "maxGasPerOperation": "0.1 MATIC",
       "dailySpendLimit": "10 MATIC",
       "allowedSenders": ["*"],
       "allowedTargets": ["0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"]
     }
   }
   ```
4. Fund the policy with MATIC (get from Polygon faucet)
5. Copy the **Policy ID** and **API Key**

## Step 3: Configure Supabase Secrets

Add the following secrets in your backend project:

```bash
# Already exists:
MASTER_WALLET_PRIVATE_KEY=0x...

# New secrets to add:
AA_FACTORY_ADDRESS=0x...  # From Step 1.5
AA_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
ALCHEMY_API_KEY=...  # From Alchemy dashboard
ALCHEMY_GAS_MANAGER_POLICY_ID=...  # From Step 2.2
AA_CHAIN_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

## Step 4: Test the System

### 4.1 Generate AA Wallet for Test User

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-aa-wallet \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "wallet_address": "0x...",
  "deployed": false,
  "message": "Smart contract wallet address generated (counterfactual). No gas required for deposits!"
}
```

### 4.2 Fund the AA Wallet

Send USDC from Polygon faucet or another wallet to the AA wallet address.

### 4.3 Trigger Gasless Sweep

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/aa-sweep-deposits \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "sweeps_completed": 1,
  "details": [{
    "user_id": "...",
    "wallet": "0x...",
    "amount": 10.5,
    "txHash": "0x...",
    "gasSponsored": true
  }],
  "message": "Gasless sweeps completed - all gas fees sponsored by FinMo"
}
```

### 4.4 Verify Results

1. Check Alchemy dashboard for gas sponsorship confirmation
2. Check `wallet_balances` table - user balance should be updated
3. Check `wallet_sweeps` table - sweep should be recorded
4. Check `transactions` table - deposit transaction should be created
5. Profile's `aa_wallet_deployed` should be `true`

## Step 5: Automate Sweeps

### Option 1: Supabase Cron (Recommended)

```sql
SELECT cron.schedule(
  'aa-gasless-sweep',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/aa-sweep-deposits',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )
  $$
);
```

### Option 2: External Scheduler

Use a service like GitHub Actions, AWS EventBridge, or Vercel Cron to call the edge function periodically.

## Step 6: Monitor Gas Costs

### Alchemy Dashboard
- View real-time gas sponsorship
- Set spending alerts
- Track UserOperations

### Database Queries

```sql
-- Daily gas sponsorship costs
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_sweeps,
  SUM(amount) as total_usdc_swept
FROM wallet_sweeps
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
```

## Step 7: Migration Strategy

### New Users
- Automatically get AA wallets via `generate-aa-wallet`
- All deposits are gasless
- Superior UX with no gas tokens needed

### Existing Users (Optional)
- Keep using EOA wallets
- Gradual migration on opt-in basis
- Both systems can run in parallel

### Hybrid Approach (Recommended)

```typescript
// In Dashboard or onboarding flow
const generateWallet = async () => {
  // Try AA wallet first
  const { data } = await supabase.functions.invoke('generate-aa-wallet');
  
  if (data?.success) {
    console.log('AA wallet generated:', data.wallet_address);
  } else {
    // Fallback to EOA if AA not configured
    const { data: eoaData } = await supabase.functions.invoke('generate-user-wallet');
    console.log('EOA wallet generated:', eoaData.wallet_address);
  }
};
```

## Troubleshooting

### Issue: "AA_FACTORY_ADDRESS not configured"
**Solution:** Deploy the factory contract (Step 1) and add the secret

### Issue: "Paymaster error: insufficient funds"
**Solution:** Fund your Alchemy Gas Manager policy with MATIC

### Issue: "UserOperation not mined within timeout"
**Solution:** 
- Check Alchemy dashboard for failed UserOps
- Verify gas limits are sufficient
- Check EntryPoint contract on block explorer

### Issue: "Bundler error: signature verification failed"
**Solution:** Verify master wallet private key is correct and has signing permissions

## Cost Analysis

### Per Sweep Operation
- **Old System (EOA):** ~0.01 MATIC (~$0.001) paid by user
- **AA System:** ~0.005 MATIC (~$0.0005) paid by FinMo via Paymaster

### Monthly Costs (10,000 sweeps)
- **Old System:** $10 (user pays, poor UX)
- **AA System:** $5 (FinMo pays, excellent UX)

**ROI:** Better UX + lower total costs + simplified operations

## Security Checklist

- [ ] Master wallet private key stored securely in Supabase secrets
- [ ] Gas Manager policy has spending limits
- [ ] Only sweep edge function can trigger UserOperations
- [ ] Paymaster policy whitelists only USDC contract
- [ ] Regular monitoring of gas sponsorship costs
- [ ] Backup plan: fallback to EOA sweeps if AA fails

## Production Deployment

1. Test thoroughly on Polygon Amoy testnet
2. Deploy factory on Polygon mainnet
3. Update chain configuration in edge functions
4. Update RPC URLs to mainnet
5. Configure mainnet Gas Manager policy
6. Gradually roll out to users
7. Monitor gas costs daily

## Support

For issues or questions:
- Check Alchemy documentation: https://docs.alchemy.com/docs/account-abstraction
- Review ERC-4337 spec: https://eips.ethereum.org/EIPS/eip-4337
- Contact FinMo development team

---

**🎉 Congratulations! Your gasless sweep system is now operational.**

Users can now deposit USDC without needing gas tokens, providing a seamless Web2-like experience powered by ERC-4337 Account Abstraction.
