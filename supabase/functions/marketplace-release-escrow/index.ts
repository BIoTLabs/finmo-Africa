import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface EscrowReleaseRequest {
  order_id: string;
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

    const requestData: EscrowReleaseRequest = await req.json();
    const { order_id } = requestData;

    console.log('Releasing escrow for order:', order_id);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Verify the user is the buyer
    if (order.buyer_id !== user.id) {
      throw new Error('Only the buyer can confirm delivery');
    }

    // Check if already released
    if (order.escrow_released) {
      throw new Error('Escrow already released');
    }

    // Get accepted delivery bid if any
    const { data: acceptedBid } = await supabase
      .from('marketplace_delivery_bids')
      .select('*')
      .eq('order_id', order_id)
      .eq('status', 'accepted')
      .maybeSingle();

    let sellerAmount = order.escrow_amount;
    let riderAmount = 0;

    if (acceptedBid) {
      // Split: seller gets order amount minus delivery fee, rider gets delivery fee
      riderAmount = Number(acceptedBid.bid_amount);
      sellerAmount = Number(order.escrow_amount) - riderAmount;
    }

    // Transfer to seller
    const { data: sellerBalance } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', order.seller_id)
      .eq('token', order.currency)
      .single();

    if (sellerBalance) {
      await supabase
        .from('wallet_balances')
        .update({ balance: Number(sellerBalance.balance) + sellerAmount })
        .eq('user_id', order.seller_id)
        .eq('token', order.currency);
    }

    // Transfer to rider if applicable
    if (acceptedBid && riderAmount > 0) {
      const { data: riderBalance } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', acceptedBid.rider_id)
        .eq('token', order.currency)
        .maybeSingle();

      if (riderBalance) {
        await supabase
          .from('wallet_balances')
          .update({ balance: Number(riderBalance.balance) + riderAmount })
          .eq('user_id', acceptedBid.rider_id)
          .eq('token', order.currency);
      } else {
        // Create balance if doesn't exist
        await supabase
          .from('wallet_balances')
          .insert({
            user_id: acceptedBid.rider_id,
            token: order.currency,
            balance: riderAmount,
          });
      }

      // Mark bid as completed
      await supabase
        .from('marketplace_delivery_bids')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', acceptedBid.id);
    }

    // Update order
    await supabase
      .from('marketplace_orders')
      .update({
        status: 'delivered',
        escrow_released: true,
        seller_amount: sellerAmount,
        rider_amount: riderAmount,
        buyer_confirmed_delivery: true,
        buyer_confirmation_date: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    // Create notifications
    await supabase.from('marketplace_notifications').insert([
      {
        user_id: order.seller_id,
        type: 'payment_received',
        title: 'Payment Received',
        message: `You received ${sellerAmount} ${order.currency} for order #${order_id.slice(0, 8)}`,
        order_id: order_id,
      },
    ]);

    if (acceptedBid) {
      await supabase.from('marketplace_notifications').insert([
        {
          user_id: acceptedBid.rider_id,
          type: 'payment_received',
          title: 'Delivery Payment Received',
          message: `You received ${riderAmount} ${order.currency} for delivery #${order_id.slice(0, 8)}`,
          order_id: order_id,
        },
      ]);
    }

    // Award reward points for marketplace purchase
    try {
      console.log('Awarding marketplace purchase points...');
      await supabase.rpc('award_points', {
        _user_id: order.buyer_id,
        _activity_type: 'marketplace_purchase',
        _metadata: { order_id, amount: order.amount }
      });
    } catch (rewardError) {
      console.error('Failed to award marketplace points:', rewardError);
      // Don't fail the escrow release if reward points fail
    }

    console.log('Escrow released successfully:', { sellerAmount, riderAmount });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery confirmed and payment released',
        sellerAmount,
        riderAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Escrow release error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to release escrow';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
