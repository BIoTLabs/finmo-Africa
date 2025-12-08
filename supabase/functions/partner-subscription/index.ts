import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

// Helper function to validate API key and get partner
async function validateApiKeyAuth(supabase: any, apiKey: string): Promise<{ partner_id: string } | null> {
  if (!apiKey) return null;
  
  // Hash the API key to compare with stored hash
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const { data: keyData, error } = await supabase
    .from('partner_api_keys')
    .select('partner_id, is_active')
    .eq('key_hash', keyHash)
    .single();
  
  if (error || !keyData || !keyData.is_active) return null;
  
  return { partner_id: keyData.partner_id };
}

// Helper function to validate JWT and get partner from user
async function validateJwtAuth(supabase: any, authHeader: string): Promise<{ partner_id: string; user_id: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.replace('Bearer ', '');
  
  // Create a client with the user's token to verify it
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  
  const { data: { user }, error } = await userSupabase.auth.getUser();
  if (error || !user) return null;
  
  // Get partner ID for this user
  const { data: partner } = await supabase
    .from('partners')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!partner) return null;
  
  return { partner_id: partner.id, user_id: user.id };
}

// Helper to check if user is admin
async function isAdmin(supabase: any, authHeader: string): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  
  const token = authHeader.replace('Bearer ', '');
  
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  
  const { data: { user }, error } = await userSupabase.auth.getUser();
  if (error || !user) return false;
  
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();
  
  return !!data;
}

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
    
    const apiKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('authorization');

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

    // All other actions require authentication
    const apiKeyAuth = apiKey ? await validateApiKeyAuth(supabase, apiKey) : null;
    const jwtAuth = authHeader ? await validateJwtAuth(supabase, authHeader) : null;
    const adminCheck = authHeader ? await isAdmin(supabase, authHeader) : false;
    
    if (!apiKeyAuth && !jwtAuth && !adminCheck) {
      console.log('Authentication failed: No valid API key or JWT provided');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key (x-api-key header) or JWT (Authorization header).' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine the authenticated partner_id
    const authenticatedPartnerId = apiKeyAuth?.partner_id || jwtAuth?.partner_id;

    // POST /partner-subscription?action=create - Create subscription for partner
    if (action === 'create') {
      const { partner_id, tier_name } = body;

      // Validate that the requester can only create subscriptions for themselves (unless admin)
      if (!adminCheck && partner_id !== authenticatedPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'You can only manage your own subscription' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const targetPartnerId = partner_id || authenticatedPartnerId;

      if (!targetPartnerId || !tier_name) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'tier_name is required' 
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
        .eq('partner_id', targetPartnerId)
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
          .eq('id', targetPartnerId);

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
          partner_id: targetPartnerId,
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
        .eq('id', targetPartnerId);

      // If free tier, auto-activate
      if (tier.monthly_fee_usdt === 0) {
        console.log(`Free tier activated for partner ${targetPartnerId}`);
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

    // GET /partner-subscription?action=status - Get subscription status (partner_id from auth)
    if (action === 'status') {
      const requestedPartnerId = url.searchParams.get('partner_id');
      
      // Determine which partner_id to use
      const targetPartnerId = adminCheck && requestedPartnerId 
        ? requestedPartnerId 
        : authenticatedPartnerId;
      
      // Non-admins can only view their own data
      if (!adminCheck && requestedPartnerId && requestedPartnerId !== authenticatedPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'You can only view your own subscription' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!targetPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No partner account linked to this user' 
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
        .eq('partner_id', targetPartnerId)
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
        .rpc('get_partner_usage_stats', { _partner_id: targetPartnerId });

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

      // Validate partner can only verify their own payments (unless admin)
      const targetPartnerId = partner_id || authenticatedPartnerId;
      
      if (!adminCheck && partner_id && partner_id !== authenticatedPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'You can only verify payments for your own subscription' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!targetPartnerId || !tx_hash || !chain_id || !token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'tx_hash, chain_id, and token are required' 
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
        .eq('partner_id', targetPartnerId)
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
            partner_id: targetPartnerId,
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
          .eq('partner_id', targetPartnerId);

        console.log(`Payment verified for partner ${targetPartnerId}: $${amountNum} ${token}`);

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

    // GET /partner-subscription?action=usage - Get usage stats (partner_id from auth)
    if (action === 'usage') {
      const requestedPartnerId = url.searchParams.get('partner_id');
      
      // Determine which partner_id to use
      const targetPartnerId = adminCheck && requestedPartnerId 
        ? requestedPartnerId 
        : authenticatedPartnerId;
      
      // Non-admins can only view their own data
      if (!adminCheck && requestedPartnerId && requestedPartnerId !== authenticatedPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'You can only view your own usage' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!targetPartnerId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No partner account linked to this user' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: usageStats } = await supabase
        .rpc('get_partner_usage_stats', { _partner_id: targetPartnerId });

      // Get recent API calls breakdown
      const { data: recentCalls } = await supabase
        .from('api_usage_logs')
        .select('endpoint, method, created_at')
        .eq('partner_id', targetPartnerId)
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
      error: 'An error occurred processing your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});