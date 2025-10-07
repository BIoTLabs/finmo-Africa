import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DepositRequest {
  token: string;
  amount: number;
  transaction_hash: string;
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

    const { token: depositToken, amount, transaction_hash }: DepositRequest = await req.json();

    console.log('Processing deposit:', { user: user.id, token: depositToken, amount, tx: transaction_hash });

    // Verify transaction hash format
    if (!transaction_hash || !transaction_hash.startsWith('0x') || transaction_hash.length !== 66) {
      throw new Error('Invalid transaction hash format');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // Check if transaction already processed
    const { data: existingTx } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('transaction_hash', transaction_hash)
      .single();

    if (existingTx) {
      throw new Error('Transaction already processed');
    }

    // Get current balance
    const { data: currentBalance, error: balanceError } = await supabaseClient
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', user.id)
      .eq('token', depositToken)
      .single();

    if (balanceError) throw balanceError;

    // Update balance
    const newBalance = Number(currentBalance.balance) + amount;
    const { error: updateError } = await supabaseClient
      .from('wallet_balances')
      .update({ balance: newBalance })
      .eq('user_id', user.id)
      .eq('token', depositToken);

    if (updateError) throw updateError;

    // Create transaction record (deposit shows as received from external address)
    const { data: transaction, error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        sender_id: null, // External sender
        recipient_id: user.id, // User receiving the deposit
        sender_wallet: '0x0000000000000000000000000000000000000000',
        recipient_wallet: profile.wallet_address,
        amount: amount,
        token: depositToken,
        transaction_type: 'deposit',
        status: 'completed',
        transaction_hash: transaction_hash,
        withdrawal_fee: 0
      })
      .select()
      .single();

    if (txError) throw txError;

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        new_balance: newBalance,
        explorer_url: `https://amoy.polygonscan.com/tx/${transaction_hash}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Deposit error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
