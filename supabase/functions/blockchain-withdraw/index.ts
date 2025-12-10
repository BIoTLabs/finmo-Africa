import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

// Chain configurations
const SUPPORTED_CHAINS = {
  137: {
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    nativeSymbol: "MATIC",
  },
  1: {
    name: "Ethereum",
    rpcUrl: "https://eth.llamarpc.com",
    nativeSymbol: "ETH",
  },
  42161: {
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
  },
  8453: {
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    nativeSymbol: "ETH",
  },
} as const;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

interface WithdrawRequest {
  recipient_wallet: string;
  amount: number;
  token: string;
  chain_id?: number;
}

// Helper function to check transaction limits
async function checkTransactionLimits(
  supabase: any,
  userId: string,
  amountUsd: number
): Promise<{ allowed: boolean; error?: string }> {
  // Get user's KYC tier from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('kyc_tier')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Failed to fetch profile for limit check:', profileError);
    return { allowed: true }; // Allow if we can't verify (fail open for UX)
  }

  const userTier = profile?.kyc_tier || 'tier_0';

  // Get tier limits
  const { data: tierLimits, error: tierError } = await supabase
    .from('kyc_tiers')
    .select('daily_limit_usd, monthly_limit_usd, single_transaction_limit_usd')
    .eq('tier', userTier)
    .eq('is_active', true)
    .single();

  if (tierError || !tierLimits) {
    console.error('Failed to fetch tier limits:', tierError);
    return { allowed: true }; // Allow if we can't verify
  }

  const dailyLimit = tierLimits.daily_limit_usd;
  const monthlyLimit = tierLimits.monthly_limit_usd;
  const singleTransactionLimit = tierLimits.single_transaction_limit_usd || dailyLimit;

  // Check single transaction limit
  if (amountUsd > singleTransactionLimit) {
    return {
      allowed: false,
      error: `Withdrawal amount ($${amountUsd.toFixed(2)}) exceeds your limit of $${singleTransactionLimit.toFixed(2)}. Upgrade your KYC tier for higher limits.`,
    };
  }

  // Get today's usage
  const today = new Date().toISOString().split('T')[0];
  const { data: limitRecord } = await supabase
    .from('user_transaction_limits')
    .select('daily_total_usd')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  const dailyUsed = Number(limitRecord?.daily_total_usd || 0);

  // Check daily limit
  if (dailyUsed + amountUsd > dailyLimit) {
    const remaining = Math.max(0, dailyLimit - dailyUsed);
    return {
      allowed: false,
      error: `Daily limit exceeded. You've used $${dailyUsed.toFixed(2)} of your $${dailyLimit.toFixed(2)} daily limit. Remaining: $${remaining.toFixed(2)}`,
    };
  }

  // Get monthly usage
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const monthStart = firstDayOfMonth.toISOString().split('T')[0];

  const { data: monthlyRecords } = await supabase
    .from('user_transaction_limits')
    .select('daily_total_usd')
    .eq('user_id', userId)
    .gte('date', monthStart);

  const monthlyUsed = monthlyRecords?.reduce((sum: number, r: any) => sum + Number(r.daily_total_usd || 0), 0) || 0;

  // Check monthly limit
  if (monthlyUsed + amountUsd > monthlyLimit) {
    const remaining = Math.max(0, monthlyLimit - monthlyUsed);
    return {
      allowed: false,
      error: `Monthly limit exceeded. You've used $${monthlyUsed.toFixed(2)} of your $${monthlyLimit.toFixed(2)} monthly limit. Remaining: $${remaining.toFixed(2)}`,
    };
  }

  return { allowed: true };
}

// Helper function to update transaction limits after successful transaction
async function updateTransactionLimits(
  supabase: any,
  userId: string,
  amountUsd: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Try to get existing record
  const { data: existing } = await supabase
    .from('user_transaction_limits')
    .select('id, daily_total_usd, transaction_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    // Update existing record
    await supabase
      .from('user_transaction_limits')
      .update({
        daily_total_usd: Number(existing.daily_total_usd || 0) + amountUsd,
        transaction_count: (existing.transaction_count || 0) + 1,
        last_transaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Insert new record
    await supabase
      .from('user_transaction_limits')
      .insert({
        user_id: userId,
        date: today,
        daily_total_usd: amountUsd,
        transaction_count: 1,
        last_transaction_at: new Date().toISOString(),
      });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check KYC verification status
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_verifications')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!kycData || kycData.status !== 'approved') {
      throw new Error('KYC verification required. Please complete your identity verification before making withdrawals.');
    }

    const requestData: WithdrawRequest = await req.json();
    const { recipient_wallet, amount, token, chain_id } = requestData;

    // Default to Polygon mainnet if no chain specified
    const selectedChainId = chain_id || 137;
    const chainConfig = SUPPORTED_CHAINS[selectedChainId as keyof typeof SUPPORTED_CHAINS];
    
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${selectedChainId}`);
    }

    // Validate amount
    if (typeof amount !== 'number' || !isFinite(amount)) {
      throw new Error('Invalid withdrawal amount');
    }
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    if (amount < 0.01) {
      throw new Error('Amount must be at least 0.01');
    }
    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum withdrawal limit');
    }

    // Check KYC tier transaction limits (assuming stablecoins are ~$1 USD)
    const amountUsd = amount; // For stablecoins, 1:1 with USD
    const limitCheck = await checkTransactionLimits(supabase, user.id, amountUsd);
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.error || 'Transaction limit exceeded');
    }

    // Validate Ethereum wallet address with checksum
    if (!ethers.isAddress(recipient_wallet)) {
      throw new Error('Invalid Ethereum wallet address format');
    }
    
    // Check checksum if address is not all lowercase
    const checksumAddress = ethers.getAddress(recipient_wallet);
    if (recipient_wallet !== recipient_wallet.toLowerCase() && recipient_wallet !== checksumAddress) {
      throw new Error('Invalid Ethereum wallet address checksum');
    }
    
    // Prevent sending to burn address
    const BURN_ADDRESSES = ['0x0000000000000000000000000000000000000000'];
    if (BURN_ADDRESSES.includes(recipient_wallet.toLowerCase())) {
      throw new Error('Cannot send to burn address');
    }

    console.log('Processing blockchain withdrawal:', { user: user.id, token, amountUsd });
    console.log(`Withdrawal request: ${amount} ${token} on chain ${selectedChainId}`);

    // Get user profile and balance
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !senderProfile) {
      throw new Error('User profile not found');
    }

    // Get aggregated balance across all chains for this token
    const { data: balances, error: balanceError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', user.id)
      .eq('token', token);

    if (balanceError || !balances || balances.length === 0) {
      throw new Error('Balance not found');
    }

    // Sum up balances across all chains
    const totalBalance = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    // Connect to blockchain to get current gas price
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    
    // Get current gas price and calculate dynamic withdrawal fee (2x average gas cost)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei');
    const estimatedGas = BigInt(65000); // Approximate gas for ERC20 transfer
    const gasCostWei = gasPrice * estimatedGas;
    
    // Convert gas cost to token terms (assuming 1 token = ~$1 for stablecoins)
    // For native tokens, use actual ETH/MATIC price approximation
    let gasCostInToken = Number(ethers.formatEther(gasCostWei));
    
    // Get fee multiplier from admin settings (default 2x)
    const { data: feeMultiplierSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_fee_multiplier')
      .single();
    
    const feeMultiplier = feeMultiplierSetting?.setting_value?.value || 2;
    
    // Calculate platform withdrawal fee (2x gas cost, minimum 0.50 for stablecoins)
    let withdrawalFee = gasCostInToken * feeMultiplier;
    
    // Set minimum fees based on token type
    const stablecoins = ['USDC', 'USDT', 'DAI'];
    if (stablecoins.includes(token)) {
      withdrawalFee = Math.max(withdrawalFee, 0.50); // Minimum $0.50 for stablecoins
    } else {
      withdrawalFee = Math.max(withdrawalFee, 0.001); // Minimum for other tokens
    }
    
    // Round to reasonable precision
    withdrawalFee = Math.round(withdrawalFee * 10000) / 10000;
    
    const totalAmount = amount + withdrawalFee;

    console.log(`Withdrawal fee calculated: ${withdrawalFee} ${token} (${feeMultiplier}x gas cost)`);

    if (totalBalance < totalAmount) {
      throw new Error(`Insufficient balance. Required: ${totalAmount.toFixed(4)} ${token} (including ${withdrawalFee.toFixed(4)} ${token} fee), Available: ${totalBalance.toFixed(4)} ${token}`);
    }

    // Get master wallet private key (should be set as secret)
    const masterWalletKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    if (!masterWalletKey) {
      throw new Error('Master wallet not configured');
    }

    const masterWallet = new ethers.Wallet(masterWalletKey, provider);

    let txHash: string;

    // Check if token is native (MATIC or ETH)
    const isNativeToken = token === chainConfig.nativeSymbol;

    if (isNativeToken) {
      // Transfer native token
      const amountInWei = ethers.parseEther(amount.toString());
      
      console.log(`Sending ${token} transaction on ${chainConfig.name}...`);
      const tx = await masterWallet.sendTransaction({
        to: recipient_wallet,
        value: amountInWei,
      });
      await tx.wait();
      txHash = tx.hash;
      console.log(`${token} transaction confirmed:`, txHash);

    } else {
      // Transfer ERC20 token - get contract address from database
      const { data: tokenConfig, error: tokenError } = await supabase
        .from('chain_tokens')
        .select('contract_address, decimals')
        .eq('token_symbol', token)
        .eq('chain_id', selectedChainId)
        .eq('is_active', true)
        .single();

      if (tokenError || !tokenConfig) {
        throw new Error(`Token ${token} not supported on chain ${selectedChainId}`);
      }

      const contract = new ethers.Contract(
        tokenConfig.contract_address,
        ERC20_ABI,
        masterWallet
      );
      const amountInWei = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

      console.log(`Sending ${token} transaction on ${chainConfig.name}...`);
      const tx = await contract.transfer(recipient_wallet, amountInWei);
      await tx.wait();
      txHash = tx.hash;
      console.log(`${token} transaction confirmed:`, txHash);
    }

    // Update user balance (deduct amount + fee)
    const balanceWithFunds = balances.find(b => Number(b.balance) >= totalAmount);
    
    if (balanceWithFunds) {
      const newBalance = Number(balanceWithFunds.balance) - totalAmount;
      await supabase
        .from('wallet_balances')
        .update({ balance: newBalance })
        .eq('user_id', user.id)
        .eq('token', token)
        .eq('balance', balanceWithFunds.balance);
    } else {
      // Deduct from first available balance
      for (const bal of balances) {
        if (Number(bal.balance) > 0) {
          const newBalance = Math.max(0, Number(bal.balance) - totalAmount);
          await supabase
            .from('wallet_balances')
            .update({ balance: newBalance })
            .eq('user_id', user.id)
            .eq('token', token)
            .eq('balance', bal.balance);
          break;
        }
      }
    }

    // Update transaction limits after successful withdrawal
    await updateTransactionLimits(supabase, user.id, amountUsd);

    // Record platform revenue from withdrawal fee
    if (withdrawalFee > 0) {
      await supabase.from('platform_revenue').insert({
        revenue_type: 'withdrawal_fee',
        amount: withdrawalFee,
        token: token,
        source_type: 'withdrawal',
        wallet_type: 'withdrawal_fees',
        metadata: {
          user_id: user.id,
          chain_id: selectedChainId,
          chain_name: chainConfig.name,
          tx_hash: txHash,
          fee_multiplier: feeMultiplier,
          gas_cost_estimate: gasCostInToken
        }
      });

      // Update platform wallet balance
      await supabase
        .from('platform_wallets')
        .update({ 
          balance: supabase.rpc('increment_balance', { amount: withdrawalFee })
        })
        .eq('wallet_type', 'withdrawal_fees')
        .eq('token', token);
        
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        sender_id: user.id,
        recipient_id: null,
        sender_wallet: senderProfile.wallet_address,
        recipient_wallet: recipient_wallet,
        amount: amount,
        token: token,
        transaction_type: 'external',
        status: 'completed',
        transaction_hash: txHash,
        chain_id: selectedChainId,
        chain_name: chainConfig.name,
        withdrawal_fee: withdrawalFee,
      })
      .select()
      .single();

    if (txError) {
      console.error('Failed to create transaction record:', txError);
    }

    console.log('Withdrawal completed successfully:', transaction?.id);

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        txHash,
        chain: chainConfig.name,
        withdrawal_fee: withdrawalFee,
        message: `Withdrawal successful! Fee: ${withdrawalFee.toFixed(4)} ${token}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Withdrawal error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    const userMessage = error instanceof Error && 
      ['Invalid Ethereum wallet address', 'Cannot send to burn address', 
       'Insufficient balance', 'KYC verification required',
       'Invalid withdrawal amount', 'Amount must be greater than zero',
       'Amount exceeds maximum withdrawal limit',
       'Daily limit exceeded', 'Monthly limit exceeded', 'Withdrawal amount'].some(msg => error.message.includes(msg))
      ? error.message
      : 'Unable to process withdrawal. Please try again later.';
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
