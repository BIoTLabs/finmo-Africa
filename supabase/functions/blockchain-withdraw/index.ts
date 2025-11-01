import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

// Polygon Mumbai Testnet configuration
const POLYGON_MUMBAI_RPC = "https://rpc-mumbai.maticvigil.com";
const USDC_CONTRACT = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

interface WithdrawRequest {
  recipient_wallet: string;
  amount: number;
  token: string;
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
    const { recipient_wallet, amount, token } = requestData;

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

    // Get user profile and balance
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !senderProfile) {
      throw new Error('User profile not found');
    }

    const { data: balance, error: balanceError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', user.id)
      .eq('token', token)
      .single();

    if (balanceError || !balance) {
      throw new Error('Balance not found');
    }

    // Get withdrawal fee from admin settings
    const { data: feeSettings } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_fees')
      .single();

    const withdrawalFee = feeSettings?.setting_value?.[token] || 0;
    const totalAmount = amount + withdrawalFee;

    if (Number(balance.balance) < totalAmount) {
      throw new Error(`Insufficient balance. Required: ${totalAmount} ${token} (including ${withdrawalFee} ${token} fee)`);
    }

    // Get master wallet private key (should be set as secret)
    const masterWalletKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    if (!masterWalletKey) {
      throw new Error('Master wallet not configured');
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(POLYGON_MUMBAI_RPC);
    const masterWallet = new ethers.Wallet(masterWalletKey, provider);

    let txHash: string;

    if (token === 'USDC') {
      // Transfer USDC token
      const contract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, masterWallet);
      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);

      console.log('Sending USDC transaction...');
      const tx = await contract.transfer(recipient_wallet, amountInWei);
      await tx.wait();
      txHash = tx.hash;
      console.log('USDC transaction confirmed:', txHash);

    } else if (token === 'MATIC') {
      // Transfer native MATIC
      const amountInWei = ethers.parseEther(amount.toString());
      
      console.log('Sending MATIC transaction...');
      const tx = await masterWallet.sendTransaction({
        to: recipient_wallet,
        value: amountInWei,
      });
      await tx.wait();
      txHash = tx.hash;
      console.log('MATIC transaction confirmed:', txHash);

    } else {
      throw new Error('Unsupported token');
    }

    // Update user balance (deduct amount + fee)
    const newBalance = Number(balance.balance) - totalAmount;
    await supabase
      .from('wallet_balances')
      .update({ balance: newBalance })
      .eq('user_id', user.id)
      .eq('token', token);

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
        explorerUrl: `https://mumbai.polygonscan.com/tx/${txHash}`,
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
