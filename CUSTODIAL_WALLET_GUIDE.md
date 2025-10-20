# Custodial Wallet System Guide

## Overview
FinMo now implements a **custodial wallet system** where each user gets their own real blockchain wallet address with encrypted private keys stored securely in the database. This allows users to deposit directly to their unique address while maintaining platform control through the master wallet.

## Architecture

### How It Works

1. **User Wallet Generation**
   - Each user gets a unique Ethereum-compatible wallet address
   - Private keys are encrypted using AES-256-GCM and stored in `profiles.wallet_private_key_encrypted`
   - Wallet addresses serve as both blockchain addresses AND user identifiers

2. **Deposit Flow**
   - Users deposit crypto to their personal wallet address
   - Deposits can be made on any supported chain (Polygon Amoy, Ethereum Sepolia)
   - Funds sit in the user's wallet temporarily

3. **Automatic Sweeping**
   - The `sweep-user-wallets` function monitors all user wallets
   - When funds are detected, they're automatically transferred to the master wallet
   - User's database balance is updated to reflect the deposit
   - Sweep transactions are recorded in `wallet_sweeps` table

4. **Withdrawal Flow**
   - User requests withdrawal through the app
   - Master wallet sends funds to the recipient address
   - User's database balance is decremented
   - Transaction is recorded with fees

## Edge Functions

### 1. `generate-user-wallet`
**Purpose:** Creates a real blockchain wallet for users

**When to call:** 
- After user registration
- When user navigates to wallet/deposit page for the first time

**Response:**
```json
{
  "success": true,
  "wallet_address": "0x...",
  "message": "Wallet generated successfully"
}
```

### 2. `sweep-user-wallets`
**Purpose:** Transfers funds from user wallets to master wallet

**When to call:**
- Scheduled via cron job (recommended: every 5-15 minutes)
- Manually via admin interface
- After deposit notifications

**Response:**
```json
{
  "success": true,
  "sweeps_completed": 5,
  "details": [...]
}
```

## Database Tables

### wallet_sweeps
Tracks all automatic transfers from user wallets to master wallet

```sql
- id: uuid
- user_id: uuid
- user_wallet_address: text
- master_wallet_address: text
- token: text (MATIC, ETH, USDC)
- amount: numeric
- sweep_tx_hash: text
- status: text (pending, completed, failed)
- created_at: timestamp
- completed_at: timestamp
```

### profiles (updated)
```sql
- wallet_private_key_encrypted: text (AES-256-GCM encrypted)
- encryption_key_version: text (default: 'v1')
```

## Setup Instructions

### 1. Ensure Secrets Are Configured
Required secrets in Supabase:
- `MASTER_WALLET_PRIVATE_KEY` - Master wallet private key
- `ENCRYPTION_KEY` - For encrypting user private keys (min 32 chars)

### 2. Schedule Automatic Sweeping
Set up a cron job or scheduled task to call `sweep-user-wallets` every 5-15 minutes:

**Option A: External Cron**
```bash
*/10 * * * * curl -X POST https://[project-id].supabase.co/functions/v1/sweep-user-wallets \
  -H "Authorization: Bearer [service-role-key]"
```

**Option B: Supabase pg_cron** (recommended for production)
```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'sweep-user-wallets',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project-id].supabase.co/functions/v1/sweep-user-wallets',
    headers := '{"Authorization": "Bearer [service-role-key]"}'::jsonb
  )
  $$
);
```

### 3. Trigger Wallet Generation for Existing Users
Run this for all existing users who don't have wallets yet:

```typescript
// In admin panel or migration script
const { data: users } = await supabase
  .from('profiles')
  .select('id')
  .is('wallet_private_key_encrypted', null);

for (const user of users) {
  await supabase.functions.invoke('generate-user-wallet', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
}
```

## Security Considerations

1. **Private Key Encryption**
   - All private keys are encrypted with AES-256-GCM
   - Encryption key must be kept secure and backed up
   - Never expose encrypted keys in logs or responses

2. **Master Wallet**
   - Keep master wallet funded for gas fees
   - Monitor master wallet balance regularly
   - Use hardware wallet for master wallet private key storage in production

3. **Sweep Frequency**
   - More frequent sweeps = less exposure time for user wallets
   - Recommended: 5-15 minute intervals
   - Consider gas costs vs security tradeoff

4. **Gas Reserves**
   - Each user wallet reserves 0.01 of native token for gas
   - Adjust in `sweep-user-wallets` if needed for your network

## Monitoring

### Check Sweep Status
```sql
SELECT 
  COUNT(*) as total_sweeps,
  SUM(amount) as total_amount,
  token,
  status
FROM wallet_sweeps
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY token, status;
```

### Check Master Wallet Balance
Users can check master wallet balance on supported chains to ensure it has funds.

### Failed Sweeps
```sql
SELECT * FROM wallet_sweeps 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

## Troubleshooting

### Issue: Master Wallet Empty
**Cause:** Sweeps haven't run or deposits haven't been made to user wallets

**Solution:**
1. Manually trigger `sweep-user-wallets`
2. Check cron job is running
3. Verify users are depositing to their wallet addresses

### Issue: Sweep Failures
**Possible causes:**
- Insufficient gas in user wallet
- Network congestion
- RPC endpoint issues

**Solution:**
1. Check edge function logs
2. Verify network connectivity
3. Ensure master wallet has gas for withdrawals

### Issue: User Can't Withdraw
**Cause:** Master wallet doesn't have sufficient funds

**Solution:**
1. Run sweep manually
2. Check if user deposits were successfully swept
3. Fund master wallet if balance is low

## Migration from Old System

If migrating from the old system where wallet addresses were just identifiers:

1. Generate real wallets for all existing users
2. Keep old wallet addresses as secondary identifiers if needed
3. Update all deposit instructions to use new wallet addresses
4. Inform users of new deposit addresses

## Best Practices

1. **Always test on testnet first**
2. **Monitor sweep success rates**
3. **Keep master wallet funded**
4. **Backup encryption keys securely**
5. **Log all sweep operations**
6. **Set up alerts for failed sweeps**
7. **Regular security audits**

## Support

For issues or questions:
1. Check edge function logs in Supabase dashboard
2. Review `wallet_sweeps` table for sweep history
3. Verify all secrets are properly configured
