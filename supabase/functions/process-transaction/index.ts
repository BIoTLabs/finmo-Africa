import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateAndNormalizePhone } from '../_shared/phoneValidation.ts';

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
    let { recipient_phone, recipient_wallet, amount, token, transaction_type } = requestData;

    // Validate amount
    if (typeof amount !== 'number' || !isFinite(amount)) {
      throw new Error('Invalid transaction amount');
    }
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    if (amount < 0.01) {
      throw new Error('Amount must be at least 0.01');
    }
    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum transaction limit');
    }
    // Validate decimal places (USDC: max 6 decimals, MATIC: max 18)
    const maxDecimals = token === 'USDC' ? 6 : 18;
    if (!Number.isInteger(amount * Math.pow(10, maxDecimals))) {
      throw new Error(`Amount has too many decimal places (max ${maxDecimals})`);
    }

    // Validate phone number if provided
    if (recipient_phone) {
      const validation = validateAndNormalizePhone(recipient_phone);
      
      if (!validation.valid) {
        console.error('Phone validation failed:', validation.error);
        throw new Error(validation.error || 'Invalid phone number format');
      }
      
      // Use normalized phone number
      recipient_phone = validation.normalized!;
    }

    console.log('Processing transaction:', { 
      sender: user.id, 
      type: transaction_type,
      token
    });

    // Handle internal transfer using atomic function
    if (transaction_type === 'internal') {
      // Get sender profile
      const { data: senderProfile, error: senderError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (senderError || !senderProfile) {
        console.error('Sender profile fetch failed:', senderError);
        throw new Error('Unable to process transaction. Please try again.');
      }

      // Lookup recipient
      let recipientId: string;
      let recipientWallet: string;

      if (recipient_phone) {
        const { data: lookupData, error: lookupError } = await supabase
          .rpc('lookup_user_by_phone', { phone: recipient_phone });

        if (lookupError || !lookupData?.[0]) {
          console.error('Recipient lookup failed:', lookupError);
          throw new Error('Recipient not found');
        }

        recipientId = lookupData[0].user_id;
        recipientWallet = lookupData[0].wallet_address;
      } else if (recipient_wallet) {
        const { data: recipientProfile, error: recipientError } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', recipient_wallet)
          .single();

        if (recipientError || !recipientProfile) {
          console.error('Recipient profile fetch failed:', recipientError);
          throw new Error('Recipient not found');
        }

        recipientId = recipientProfile.id;
        recipientWallet = recipientProfile.wallet_address;
      } else {
        throw new Error('Recipient information required');
      }

      // Prevent self-transfer
      if (recipientId === user.id) {
        throw new Error('Cannot transfer to yourself');
      }

      // Use atomic transfer function to prevent race conditions
      const { data: transactionId, error: transferError } = await supabase
        .rpc('process_internal_transfer', {
          _sender_id: user.id,
          _recipient_id: recipientId,
          _amount: amount,
          _token: token,
          _sender_wallet: senderProfile.wallet_address,
          _recipient_wallet: recipientWallet,
          _transaction_type: 'internal'
        });

      if (transferError) {
        console.error('Transfer failed:', transferError);
        // Return user-friendly error messages
        if (transferError.message.includes('Insufficient balance')) {
          throw new Error('Insufficient balance');
        } else if (transferError.message.includes('Sender wallet not found')) {
          throw new Error('Wallet not found');
        }
        throw new Error('Unable to process transaction. Please try again.');
      }

      console.log('Transfer completed:', transactionId);
      
      // Award reward points for transaction
      try {
        // Check if this is user's first transaction
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', user.id);
        
        const isFirstTransaction = count === 1; // count is 1 because we just created the transaction
        
        if (isFirstTransaction) {
          console.log('Awarding first transaction points...');
          await supabase.rpc('award_points', {
            _user_id: user.id,
            _activity_type: 'first_transaction',
            _metadata: {}
          });
        } else {
          console.log('Awarding transaction frequency and volume points...');
          await supabase.rpc('award_points', {
            _user_id: user.id,
            _activity_type: 'transaction_frequency',
            _metadata: {}
          });
          await supabase.rpc('award_points', {
            _user_id: user.id,
            _activity_type: 'transaction_volume',
            _metadata: { volume: amount }
          });
        }
      } catch (rewardError) {
        console.error('Failed to award points:', rewardError);
        // Don't fail the transaction if reward points fail
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transactionId,
          message: 'Transfer completed successfully!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle external withdrawals (to blockchain)
    if (transaction_type === 'external' && recipient_wallet) {
      // External withdrawals are handled by the blockchain-withdraw function
      throw new Error('External withdrawals must use /blockchain-withdraw endpoint');
    }

    throw new Error('Invalid transaction type or missing parameters');

  } catch (error) {
    console.error('Transaction error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error message to user
    const userMessage = error instanceof Error && 
      ['Insufficient balance', 'Recipient not found', 'Cannot transfer to yourself', 
       'Invalid transaction amount', 'Amount must be greater than zero',
       'Amount exceeds maximum transaction limit', 'Invalid phone number format'].some(msg => error.message.includes(msg))
      ? error.message
      : 'Unable to process transaction. Please try again later.';
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
