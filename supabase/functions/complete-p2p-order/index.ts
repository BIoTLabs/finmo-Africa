import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
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

    // Get P2P fee settings from admin_settings
    const { data: sellerFeeSetting } = await supabaseClient
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'p2p_seller_fee_percent')
      .single();

    const sellerFeePercent = sellerFeeSetting?.setting_value?.value || 0.5; // Default 0.5%
    
    // Calculate platform fee (only charged to seller)
    const platformFee = (Number(order.crypto_amount) * sellerFeePercent) / 100;
    const sellerReceives = Number(order.crypto_amount) - platformFee;

    console.log(`P2P Fee: ${platformFee} ${order.token} (${sellerFeePercent}% of ${order.crypto_amount})`);

    // Transfer crypto to buyer (full amount - buyer pays no fee)
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

    // Update order status with fee information
    const { error: updateOrderError } = await supabaseClient
      .from('p2p_orders')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        platform_fee: platformFee,
        platform_fee_token: order.token,
        fee_paid_by: 'seller'
      })
      .eq('id', order_id);

    if (updateOrderError) throw updateOrderError;

    // Record platform revenue from P2P fee
    if (platformFee > 0) {
      await supabaseClient.from('platform_revenue').insert({
        revenue_type: 'p2p_fee',
        amount: platformFee,
        token: order.token,
        source_order_id: order_id,
        source_type: 'p2p_order',
        wallet_type: 'p2p_fees',
        metadata: {
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          crypto_amount: order.crypto_amount,
          fiat_amount: order.fiat_amount,
          fee_percent: sellerFeePercent
        }
      });

      console.log(`Recorded P2P revenue: ${platformFee} ${order.token}`);
    }

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
        withdrawal_fee: platformFee
      });

    // Award reward points for both buyer and seller
    try {
      console.log('Awarding P2P trade points...');
      await supabaseClient.rpc('award_points', {
        _user_id: order.buyer_id,
        _activity_type: 'p2p_trade',
        _metadata: { order_id, role: 'buyer', amount: order.crypto_amount }
      });
      await supabaseClient.rpc('award_points', {
        _user_id: order.seller_id,
        _activity_type: 'p2p_trade',
        _metadata: { order_id, role: 'seller', amount: order.crypto_amount, fee_paid: platformFee }
      });
    } catch (rewardError) {
      console.error('Failed to award P2P points:', rewardError);
      // Don't fail the order if reward points fail
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id,
        buyer_new_balance: newBuyerBalance,
        platform_fee: platformFee,
        fee_percent: sellerFeePercent,
        message: `Order completed! Platform fee: ${platformFee.toFixed(4)} ${order.token} (${sellerFeePercent}%)`
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