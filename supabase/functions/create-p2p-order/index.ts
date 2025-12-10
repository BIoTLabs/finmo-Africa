import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface P2POrderRequest {
  listing_id: string;
  crypto_amount: number;
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
      error: `Order amount ($${amountUsd.toFixed(2)}) exceeds your limit of $${singleTransactionLimit.toFixed(2)}. Upgrade your KYC tier for higher limits.`,
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

    const { listing_id, crypto_amount }: P2POrderRequest = await req.json();

    console.log('Creating P2P order:', { user: user.id, listing_id, crypto_amount });

    // Get listing details
    const { data: listing, error: listingError } = await supabaseClient
      .from('p2p_listings')
      .select('*')
      .eq('id', listing_id)
      .eq('is_active', true)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found or inactive');
    }

    // Validate amount
    if (crypto_amount < listing.min_amount || crypto_amount > listing.max_amount) {
      throw new Error(`Amount must be between ${listing.min_amount} and ${listing.max_amount}`);
    }

    if (crypto_amount > listing.available_amount) {
      throw new Error('Insufficient liquidity');
    }

    // Calculate fiat amount (use as USD equivalent for limit checking)
    const fiat_amount = crypto_amount * listing.rate;
    const amountUsd = crypto_amount; // For stablecoins, crypto amount ~ USD

    // Check KYC tier transaction limits for the user placing the order
    const limitCheck = await checkTransactionLimits(supabaseClient, user.id, amountUsd);
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.error || 'Transaction limit exceeded');
    }

    // Determine buyer and seller based on listing type
    const buyer_id = listing.listing_type === 'sell' ? user.id : listing.user_id;
    const seller_id = listing.listing_type === 'sell' ? listing.user_id : user.id;

    // If user is buying, check their balance
    if (buyer_id === user.id) {
      const { data: balance, error: balanceError } = await supabaseClient
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', user.id)
        .eq('token', listing.token)
        .single();

      if (balanceError || !balance || Number(balance.balance) < crypto_amount) {
        throw new Error('Insufficient balance');
      }

      // Lock funds by deducting from buyer's balance
      const newBalance = Number(balance.balance) - crypto_amount;
      const { error: updateError } = await supabaseClient
        .from('wallet_balances')
        .update({ balance: newBalance })
        .eq('user_id', user.id)
        .eq('token', listing.token);

      if (updateError) throw updateError;
    }

    // Create P2P order
    const expires_at = new Date();
    expires_at.setMinutes(expires_at.getMinutes() + listing.payment_time_limit);

    const { data: order, error: orderError } = await supabaseClient
      .from('p2p_orders')
      .insert({
        listing_id: listing_id,
        buyer_id: buyer_id,
        seller_id: seller_id,
        token: listing.token,
        crypto_amount: crypto_amount,
        fiat_amount: fiat_amount,
        rate: listing.rate,
        currency_code: listing.currency_code,
        status: 'pending',
        payment_method_id: listing.payment_method_id,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Update listing available amount
    const { error: updateListingError } = await supabaseClient
      .from('p2p_listings')
      .update({ available_amount: listing.available_amount - crypto_amount })
      .eq('id', listing_id);

    if (updateListingError) throw updateListingError;

    // Update transaction limits for the user placing the order
    await updateTransactionLimits(supabaseClient, user.id, amountUsd);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        expires_at: expires_at.toISOString(),
        fiat_amount: fiat_amount,
        crypto_amount: crypto_amount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('P2P order error:', error);
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
