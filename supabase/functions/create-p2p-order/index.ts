import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface P2POrderRequest {
  listing_id: string;
  crypto_amount: number;
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

    // Calculate fiat amount
    const fiat_amount = crypto_amount * listing.rate;

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
