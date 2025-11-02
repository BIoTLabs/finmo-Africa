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
  80001: {
    name: "Polygon Mumbai",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    nativeSymbol: "MATIC",
  },
  80002: {
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    nativeSymbol: "MATIC",
  },
  11155111: {
    name: "Ethereum Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    nativeSymbol: "ETH",
  },
  421614: {
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeSymbol: "ETH",
  },
  84532: {
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    nativeSymbol: "ETH",
  },
  11155420: {
    name: "Optimism Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    nativeSymbol: "ETH",
  },
  534351: {
    name: "Scroll Sepolia",
    rpcUrl: "https://sepolia-rpc.scroll.io",
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

    // Default to Polygon Mumbai if no chain specified
    const selectedChainId = chain_id || 80001;
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

    console.log('Processing blockchain withdrawal:', { user: user.id, token });

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

    // Get withdrawal fee from admin settings
    const { data: feeSettings } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_fees')
      .single();

    const withdrawalFee = feeSettings?.setting_value?.[token] || 0;
    const totalAmount = amount + withdrawalFee;

    if (totalBalance < totalAmount) {
      throw new Error(`Insufficient balance. Required: ${totalAmount} ${token} (including ${withdrawalFee} ${token} fee), Available: ${totalBalance} ${token}`);
    }

    // Get master wallet private key (should be set as secret)
    const masterWalletKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    if (!masterWalletKey) {
      throw new Error('Master wallet not configured');
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
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

    // Update user balance (deduct amount + fee) - find first non-zero balance and deduct from it
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
      // Deduct proportionally from all balances if no single balance has enough
      for (const bal of balances) {
        if (Number(bal.balance) > 0) {
          const newBalance = Math.max(0, Number(bal.balance) - totalAmount);
          await supabase
            .from('wallet_balances')
            .update({ balance: newBalance })
            .eq('user_id', user.id)
            .eq('token', token)
            .eq('balance', bal.balance);
          break; // Only deduct from first available
        }
      }
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
        message: 'Withdrawal successful! Transaction confirmed on blockchain.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Withdrawal error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error message to user except for known user errors
    const userMessage = error instanceof Error && 
      ['Invalid Ethereum wallet address', 'Cannot send to burn address', 
       'Insufficient balance', 'KYC verification required',
       'Invalid withdrawal amount', 'Amount must be greater than zero',
       'Amount exceeds maximum withdrawal limit'].some(msg => error.message.includes(msg))
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
