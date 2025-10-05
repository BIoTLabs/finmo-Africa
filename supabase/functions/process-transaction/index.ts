import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionRequest {
  recipient_phone?: string;
  recipient_wallet?: string;
  amount: number;
  token: string;
  transaction_type: 'internal' | 'external';
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

    // Get user from auth header
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

    const requestData: TransactionRequest = await req.json();
    const { recipient_phone, recipient_wallet, amount, token, transaction_type } = requestData;

    console.log('Processing transaction:', { user: user.id, amount, token, transaction_type });

    // Get sender profile
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (senderError || !senderProfile) {
      throw new Error('Sender profile not found');
    }

    // Check sender balance
    const { data: senderBalance, error: balanceError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', user.id)
      .eq('token', token)
      .single();

    if (balanceError || !senderBalance || Number(senderBalance.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    let recipientId: string | null = null;
    let finalRecipientWallet = recipient_wallet;

    // For internal transfers, look up recipient using secure function
    if (transaction_type === 'internal' && recipient_phone) {
      const { data: registryData, error: registryError } = await supabase
        .rpc('lookup_user_by_phone', { phone: recipient_phone });

      if (registryError || !registryData || registryData.length === 0) {
        throw new Error('Recipient not found on FinMo');
      }

      const recipientInfo = registryData[0];
      finalRecipientWallet = recipientInfo.wallet_address;
      recipientId = recipientInfo.user_id;
    }

    if (!finalRecipientWallet) {
      throw new Error('Invalid recipient');
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        sender_wallet: senderProfile.wallet_address,
        recipient_wallet: finalRecipientWallet,
        amount: amount,
        token: token,
        transaction_type: transaction_type,
        status: 'completed',
        transaction_hash: transaction_type === 'external' ? `0x${Math.random().toString(16).slice(2)}` : null,
      })
      .select()
      .single();

    if (txError) {
      throw new Error('Failed to create transaction');
    }

    // Update sender balance
    const newSenderBalance = Number(senderBalance.balance) - amount;
    await supabase
      .from('wallet_balances')
      .update({ balance: newSenderBalance })
      .eq('user_id', user.id)
      .eq('token', token);

    // For internal transfers, update recipient balance
    if (transaction_type === 'internal' && recipientId) {
      const { data: recipientBalance } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', recipientId)
        .eq('token', token)
        .single();

      if (recipientBalance) {
        const newRecipientBalance = Number(recipientBalance.balance) + amount;
        await supabase
          .from('wallet_balances')
          .update({ balance: newRecipientBalance })
          .eq('user_id', recipientId)
          .eq('token', token);
      }
    }

    console.log('Transaction completed:', transaction.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction,
        message: transaction_type === 'internal' 
          ? 'Transfer completed instantly!' 
          : 'Transaction submitted to blockchain'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transaction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
