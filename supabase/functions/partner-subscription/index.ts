import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method !== 'GET' ? await req.json() : {};

    // GET /partner-subscription?action=tiers - List all tiers (public)
    if (action === 'tiers') {
      const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: tiers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /partner-subscription?action=create - Create subscription for partner
    if (action === 'create') {
      const { partner_id, tier_name } = body;

      if (!partner_id || !tier_name) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'partner_id and tier_name are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get tier info
      const { data: tier, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('name', tier_name)
        .eq('is_active', true)
        .single();

      if (tierError || !tier) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid tier' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if partner already has a subscription
      const { data: existingSub } = await supabase
        .from('partner_subscriptions')
        .select('*')
        .eq('partner_id', partner_id)
        .single();

      if (existingSub) {
        // Update existing subscription
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const { data: updatedSub, error: updateError } = await supabase
          .from('partner_subscriptions')
          .update({
            tier_id: tier.id,
            status: tier.monthly_fee_usdt === 0 ? 'active' : 'pending',
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            amount_due: tier.monthly_fee_usdt,
            amount_paid: tier.monthly_fee_usdt === 0 ? tier.monthly_fee_usdt : 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Update partner's current tier
        await supabase
          .from('partners')
          .update({ current_tier_id: tier.id })
          .eq('id', partner_id);

        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            subscription: updatedSub,
            tier,
            payment_required: tier.monthly_fee_usdt > 0,
            payment_wallet: existingSub.payment_wallet_address,
            amount_due: tier.monthly_fee_usdt
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate unique payment wallet for this partner
      const wallet = ethers.Wallet.createRandom();
      const paymentWalletAddress = wallet.address;

      // Store encrypted private key for later sweeping
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32));
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoder.encode(wallet.privateKey)
      );
      const encryptedPrivateKey = btoa(String.fromCharCode(...iv)) + ':' + 
        btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Create subscription
      const { data: subscription, error: subError } = await supabase
        .from('partner_subscriptions')
        .insert({
          partner_id,
          tier_id: tier.id,
          status: tier.monthly_fee_usdt === 0 ? 'active' : 'pending',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          payment_wallet_address: paymentWalletAddress,
          amount_due: tier.monthly_fee_usdt,
          amount_paid: tier.monthly_fee_usdt === 0 ? tier.monthly_fee_usdt : 0
        })
        .select()
        .single();

      if (subError) throw subError;

      // Update partner's current tier
      await supabase
        .from('partners')
        .update({ 
          current_tier_id: tier.id,
          metadata: { 
            payment_wallet_encrypted_key: encryptedPrivateKey 
          }
        })
        .eq('id', partner_id);

      // If free tier, auto-activate
      if (tier.monthly_fee_usdt === 0) {
        console.log(`Free tier activated for partner ${partner_id}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          subscription,
          tier,
          payment_required: tier.monthly_fee_usdt > 0,
          payment_wallet: paymentWalletAddress,
          amount_due: tier.monthly_fee_usdt,
          accepted_tokens: ['USDT', 'USDC'],
          supported_chains: [
            { chain_id: 137, name: 'Polygon', recommended: true },
            { chain_id: 1, name: 'Ethereum' },
            { chain_id: 42161, name: 'Arbitrum' },
            { chain_id: 8453, name: 'Base' }
          ]
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /partner-subscription?action=status&partner_id=xxx - Get subscription status
    if (action === 'status') {
      const partnerId = url.searchParams.get('partner_id');
      
      if (!partnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'partner_id is required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: subscription, error } = await supabase
        .from('partner_subscriptions')
        .select(`
          *,
          tier:subscription_tiers(*)
        `)
        .eq('partner_id', partnerId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No subscription found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get usage stats
      const { data: usageStats } = await supabase
        .rpc('get_partner_usage_stats', { _partner_id: partnerId });

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          subscription,
          usage: usageStats
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /partner-subscription?action=verify-payment - Verify payment received
    if (action === 'verify-payment') {
      const { partner_id, tx_hash, chain_id, token } = body;

      if (!partner_id || !tx_hash || !chain_id || !token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'partner_id, tx_hash, chain_id, and token are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!['USDT', 'USDC'].includes(token)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Only USDT and USDC are accepted' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get subscription
      const { data: subscription, error: subError } = await supabase
        .from('partner_subscriptions')
        .select(`*, tier:subscription_tiers(*)`)
        .eq('partner_id', partner_id)
        .single();

      if (subError || !subscription) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Subscription not found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get chain info for RPC
      const { data: chain } = await supabase
        .from('supported_chains')
        .select('*')
        .eq('chain_id', chain_id)
        .single();

      if (!chain) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unsupported chain' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify transaction on-chain
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpc_url);
        const receipt = await provider.getTransactionReceipt(tx_hash);

        if (!receipt || receipt.status !== 1) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Transaction not confirmed or failed' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get token contract
        const { data: tokenInfo } = await supabase
          .from('chain_tokens')
          .select('*')
          .eq('chain_id', chain_id)
          .eq('token_symbol', token)
          .single();

        if (!tokenInfo) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Token not found on this chain' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Parse transfer event to get amount
        const transferTopic = ethers.id("Transfer(address,address,uint256)");
        const transferLog = receipt.logs.find(log => 
          log.topics[0] === transferTopic &&
          log.address.toLowerCase() === tokenInfo.contract_address.toLowerCase()
        );

        if (!transferLog) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'No token transfer found in transaction' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Decode amount
        const amount = ethers.formatUnits(transferLog.data, tokenInfo.decimals);
        const amountNum = parseFloat(amount);

        if (amountNum < subscription.tier.monthly_fee_usdt) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Insufficient payment. Required: $${subscription.tier.monthly_fee_usdt}, Received: $${amountNum}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Record payment
        const { error: paymentError } = await supabase
          .from('subscription_payments')
          .insert({
            subscription_id: subscription.id,
            partner_id,
            amount: amountNum,
            token,
            chain_id,
            chain_name: chain.chain_name,
            tx_hash,
            to_wallet_address: subscription.payment_wallet_address,
            status: 'confirmed',
            period_start: subscription.current_period_start,
            period_end: subscription.current_period_end,
            confirmed_at: new Date().toISOString(),
            expires_at: subscription.current_period_end
          });

        if (paymentError) throw paymentError;

        // Activate subscription
        await supabase
          .from('partner_subscriptions')
          .update({
            status: 'active',
            amount_paid: amountNum,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        // Update partner rate limits based on tier
        await supabase
          .from('partner_api_keys')
          .update({
            rate_limit_per_minute: subscription.tier.rate_limit_per_minute
          })
          .eq('partner_id', partner_id);

        console.log(`Payment verified for partner ${partner_id}: $${amountNum} ${token}`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Payment verified and subscription activated',
          data: {
            amount_paid: amountNum,
            token,
            tier: subscription.tier.display_name,
            valid_until: subscription.current_period_end
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (verifyError) {
        console.error('Transaction verification error:', verifyError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to verify transaction' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /partner-subscription?action=usage&partner_id=xxx - Get usage stats
    if (action === 'usage') {
      const partnerId = url.searchParams.get('partner_id');
      
      if (!partnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'partner_id is required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: usageStats } = await supabase
        .rpc('get_partner_usage_stats', { _partner_id: partnerId });

      // Get recent API calls breakdown
      const { data: recentCalls } = await supabase
        .from('api_usage_logs')
        .select('endpoint, method, created_at')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          stats: usageStats,
          recent_calls: recentCalls
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action. Use: tiers, create, status, verify-payment, usage' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Partner subscription error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});