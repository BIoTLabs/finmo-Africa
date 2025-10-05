import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteOrderRequest {
  order_id: string;
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

    const { order_id }: CompleteOrderRequest = await req.json();

    console.log('Completing P2P order:', { user: user.id, order_id });

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('p2p_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Only seller can complete the order
    if (order.seller_id !== user.id) {
      throw new Error('Only seller can complete the order');
    }

    if (order.status !== 'paid') {
      throw new Error('Order must be marked as paid before completion');
    }

    // Check if expired
    if (new Date(order.expires_at) < new Date()) {
      throw new Error('Order has expired');
    }

    // Transfer crypto to buyer
    const { data: buyerBalance, error: buyerBalanceError } = await supabaseClient
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', order.buyer_id)
      .eq('token', order.token)
      .single();

    if (buyerBalanceError) throw buyerBalanceError;

    const newBuyerBalance = Number(buyerBalance.balance) + Number(order.crypto_amount);
    const { error: updateBuyerError } = await supabaseClient
      .from('wallet_balances')
      .update({ balance: newBuyerBalance })
      .eq('user_id', order.buyer_id)
      .eq('token', order.token);

    if (updateBuyerError) throw updateBuyerError;

    // Update order status
    const { error: updateOrderError } = await supabaseClient
      .from('p2p_orders')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateOrderError) throw updateOrderError;

    // Get profiles for transaction record
    const { data: buyerProfile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', order.buyer_id)
      .single();

    const { data: sellerProfile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', order.seller_id)
      .single();

    // Create transaction record
    await supabaseClient
      .from('transactions')
      .insert({
        sender_id: order.seller_id,
        recipient_id: order.buyer_id,
        sender_wallet: sellerProfile?.wallet_address || '0x0',
        recipient_wallet: buyerProfile?.wallet_address || '0x0',
        amount: order.crypto_amount,
        token: order.token,
        transaction_type: 'p2p',
        status: 'completed',
        transaction_hash: `0xp2p${order_id.slice(0, 40)}`,
        withdrawal_fee: 0
      });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id,
        buyer_new_balance: newBuyerBalance
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Complete P2P order error:', error);
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
