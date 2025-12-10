import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateAndNormalizePhone } from '../_shared/phoneValidation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface TransactionRequest {
  recipient_phone?: string;
  recipient_wallet?: string;
  amount: number;
  token: string;
  transaction_type: 'internal' | 'external';
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
      error: `Transaction amount ($${amountUsd.toFixed(2)}) exceeds your limit of $${singleTransactionLimit.toFixed(2)}. Upgrade your KYC tier for higher limits.`,
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

    // Check KYC tier transaction limits (assuming stablecoins are ~$1 USD)
    const amountUsd = amount; // For stablecoins, 1:1 with USD
    const limitCheck = await checkTransactionLimits(supabase, user.id, amountUsd);
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.error || 'Transaction limit exceeded');
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
      token,
      amountUsd
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

      // Update transaction limits after successful transfer
      await updateTransactionLimits(supabase, user.id, amountUsd);
      
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
       'Amount exceeds maximum transaction limit', 'Invalid phone number format',
       'Daily limit exceeded', 'Monthly limit exceeded', 'Transaction amount'].some(msg => error.message.includes(msg))
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
