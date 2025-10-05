import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_MUMBAI_RPC = "https://rpc-mumbai.maticvigil.com";

interface VerifyDepositRequest {
  transaction_hash: string;
  expected_amount: number;
  token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { transaction_hash, expected_amount, token: depositToken }: VerifyDepositRequest = await req.json();

    console.log('Verifying deposit:', { user: user.id, tx: transaction_hash, amount: expected_amount });

    // Validate transaction hash format
    if (!transaction_hash || !transaction_hash.startsWith('0x') || transaction_hash.length !== 66) {
      throw new Error('Invalid transaction hash format');
    }

    // Get user profile to verify wallet address
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Fetch transaction from blockchain
    const response = await fetch(POLYGON_MUMBAI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [transaction_hash],
        id: 1,
      }),
    });

    const txData = await response.json();

    if (!txData.result) {
      throw new Error('Transaction not found on blockchain');
    }

    const tx = txData.result;

    // Verify transaction is confirmed
    const receiptResponse = await fetch(POLYGON_MUMBAI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [transaction_hash],
        id: 1,
      }),
    });

    const receiptData = await receiptResponse.json();

    if (!receiptData.result) {
      throw new Error('Transaction not yet confirmed');
    }

    const receipt = receiptData.result;

    // Check if transaction was successful
    if (receipt.status !== '0x1') {
      throw new Error('Transaction failed on blockchain');
    }

    // Verify recipient is the user's wallet
    const recipientAddress = tx.to?.toLowerCase();
    const userWallet = profile.wallet_address.toLowerCase();

    if (recipientAddress !== userWallet) {
      throw new Error('Transaction recipient does not match your wallet address');
    }

    // Parse amount from transaction value (for MATIC) or logs (for tokens)
    let actualAmount = 0;
    
    if (depositToken === 'MATIC') {
      // For native MATIC, use tx.value
      const weiValue = BigInt(tx.value);
      actualAmount = Number(weiValue) / 1e18;
    } else {
      // For ERC20 tokens, parse Transfer event from logs
      // This is simplified - in production, decode the log data properly
      const transferLog = receipt.logs?.find((log: any) => 
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      );
      
      if (transferLog) {
        const value = BigInt(transferLog.data);
        actualAmount = Number(value) / 1e6; // USDC has 6 decimals
      }
    }

    // Verify amount matches (with small tolerance for gas)
    const tolerance = 0.01;
    if (Math.abs(actualAmount - expected_amount) > tolerance) {
      throw new Error(`Amount mismatch: expected ${expected_amount}, got ${actualAmount}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        transaction: {
          hash: transaction_hash,
          from: tx.from,
          to: tx.to,
          amount: actualAmount,
          block: receipt.blockNumber,
          confirmed: true,
        },
        message: 'Transaction verified successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false,
        verified: false,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
