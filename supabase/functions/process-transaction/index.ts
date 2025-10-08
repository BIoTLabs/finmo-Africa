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

    // Handle internal transfers (FinMo to FinMo)
    if (transaction_type === 'internal' && recipient_phone) {
      const { data: registryData, error: registryError } = await supabase
        .rpc('lookup_user_by_phone', { phone: recipient_phone });

      if (registryError || !registryData || registryData.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Recipient not registered on FinMo',
            message: `The phone number ${recipient_phone} is not registered on FinMo. Please invite them to join and try again later.`,
            shouldInvite: true
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const recipientInfo = registryData[0];
      finalRecipientWallet = recipientInfo.wallet_address;
      recipientId = recipientInfo.user_id;

      // Create internal transaction record (database only, no blockchain)
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          sender_wallet: senderProfile.wallet_address,
          recipient_wallet: finalRecipientWallet,
          amount: amount,
          token: token,
          transaction_type: 'internal',
          status: 'completed',
          transaction_hash: null,
          withdrawal_fee: 0,
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

      // Update recipient balance
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

      console.log('Internal transfer completed:', transaction.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          transaction,
          message: 'Transfer completed instantly!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle external withdrawals (to blockchain)
    if (transaction_type === 'external' && recipient_wallet) {
      // External withdrawals are handled by the blockchain-withdraw function
      // This endpoint just validates and routes to the blockchain function
      throw new Error('External withdrawals must use /blockchain-withdraw endpoint');
    }

    throw new Error('Invalid transaction type or missing parameters');


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
