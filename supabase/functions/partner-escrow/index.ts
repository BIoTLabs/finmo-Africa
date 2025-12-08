import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Private-Network': 'true',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate partner
    const authResult = await authenticatePartner(req, supabase);
    if (!authResult.success) {
      return authResult.response!;
    }

    const { partnerId, scopes } = authResult;
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const escrowId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Check scopes
    if (!scopes?.includes('escrow:read') && !scopes?.includes('escrow:write')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions for escrow operations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route requests
    if (req.method === 'GET' && !escrowId) {
      return await listEscrows(req, supabase, partnerId!);
    } else if (req.method === 'GET' && escrowId && !action) {
      return await getEscrow(supabase, partnerId!, escrowId);
    } else if (req.method === 'POST' && !escrowId) {
      if (!scopes?.includes('escrow:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await createEscrow(req, supabase, partnerId!);
    } else if (req.method === 'POST' && escrowId && action) {
      if (!scopes?.includes('escrow:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      switch (action) {
        case 'fund':
          return await fundEscrow(req, supabase, partnerId!, escrowId);
        case 'release':
          return await releaseEscrow(req, supabase, partnerId!, escrowId);
        case 'dispute':
          return await disputeEscrow(req, supabase, partnerId!, escrowId);
        case 'refund':
          return await refundEscrow(req, supabase, partnerId!, escrowId);
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Partner escrow error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function authenticatePartner(req: Request, supabase: any) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const { data: keyHash } = await supabase.rpc('hash_api_key', { _key: apiKey });

  const { data: apiKeyData, error } = await supabase
    .from('partner_api_keys')
    .select('id, partner_id, is_active, expires_at, scopes, partners!inner(status)')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKeyData) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  if (!apiKeyData.is_active) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'API key is inactive' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'API key has expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  if (apiKeyData.partners?.status !== 'approved') {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'Partner account not approved' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  return { success: true, partnerId: apiKeyData.partner_id, scopes: apiKeyData.scopes };
}

async function createEscrow(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { buyer_wallet_id, seller_wallet_id, amount, token, description, external_reference, expires_in_hours, metadata } = body;

  if (!buyer_wallet_id || !amount) {
    return new Response(JSON.stringify({ error: 'buyer_wallet_id and amount are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify buyer wallet belongs to partner
  const { data: buyerWallet, error: walletError } = await supabase
    .from('partner_wallets')
    .select('id, partner_id')
    .eq('id', buyer_wallet_id)
    .eq('partner_id', partnerId)
    .single();

  if (walletError || !buyerWallet) {
    return new Response(JSON.stringify({ error: 'Buyer wallet not found or does not belong to partner' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Calculate expiry
  const expiresAt = expires_in_hours 
    ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // Default 72 hours

  // Calculate fee (1% platform fee)
  const fee = parseFloat(amount) * 0.01;

  const { data: escrow, error } = await supabase
    .from('partner_escrows')
    .insert({
      partner_id: partnerId,
      buyer_wallet_id,
      seller_wallet_id: seller_wallet_id || null,
      amount: parseFloat(amount),
      fee,
      token: token || 'USDC',
      description,
      external_reference,
      expires_at: expiresAt,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Create escrow error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create escrow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Trigger webhook
  await triggerWebhook(supabase, partnerId, 'escrow.created', escrow);

  return new Response(JSON.stringify({ success: true, escrow }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fundEscrow(req: Request, supabase: any, partnerId: string, escrowId: string) {
  // Get escrow
  const { data: escrow, error: escrowError } = await supabase
    .from('partner_escrows')
    .select('*')
    .eq('id', escrowId)
    .eq('partner_id', partnerId)
    .single();

  if (escrowError || !escrow) {
    return new Response(JSON.stringify({ error: 'Escrow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (escrow.status !== 'created') {
    return new Response(JSON.stringify({ error: `Cannot fund escrow in ${escrow.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check buyer wallet balance
  const { data: balance, error: balanceError } = await supabase
    .from('partner_wallet_balances')
    .select('balance')
    .eq('wallet_id', escrow.buyer_wallet_id)
    .eq('token', escrow.token)
    .single();

  const totalRequired = parseFloat(escrow.amount) + parseFloat(escrow.fee);
  if (balanceError || !balance || parseFloat(balance.balance) < totalRequired) {
    return new Response(JSON.stringify({ 
      error: 'Insufficient balance', 
      required: totalRequired,
      available: balance?.balance || 0 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deduct from buyer wallet
  const { error: deductError } = await supabase
    .from('partner_wallet_balances')
    .update({ balance: parseFloat(balance.balance) - totalRequired })
    .eq('wallet_id', escrow.buyer_wallet_id)
    .eq('token', escrow.token);

  if (deductError) {
    return new Response(JSON.stringify({ error: 'Failed to deduct funds' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update escrow status
  const { data: updatedEscrow, error: updateError } = await supabase
    .from('partner_escrows')
    .update({ status: 'funded', funded_at: new Date().toISOString() })
    .eq('id', escrowId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update escrow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Log transaction
  await supabase.from('partner_transactions').insert({
    partner_id: partnerId,
    source_wallet_id: escrow.buyer_wallet_id,
    amount: totalRequired,
    token: escrow.token,
    transaction_type: 'escrow_fund',
    status: 'completed',
    external_reference: escrowId,
  });

  await triggerWebhook(supabase, partnerId, 'escrow.funded', updatedEscrow);

  return new Response(JSON.stringify({ success: true, escrow: updatedEscrow }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function releaseEscrow(req: Request, supabase: any, partnerId: string, escrowId: string) {
  const body = await req.json().catch(() => ({}));

  const { data: escrow, error: escrowError } = await supabase
    .from('partner_escrows')
    .select('*')
    .eq('id', escrowId)
    .eq('partner_id', partnerId)
    .single();

  if (escrowError || !escrow) {
    return new Response(JSON.stringify({ error: 'Escrow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (escrow.status !== 'funded') {
    return new Response(JSON.stringify({ error: `Cannot release escrow in ${escrow.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use provided seller_wallet_id or the one from escrow
  const sellerWalletId = body.seller_wallet_id || escrow.seller_wallet_id;
  if (!sellerWalletId) {
    return new Response(JSON.stringify({ error: 'seller_wallet_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Credit seller wallet
  const { data: existingBalance } = await supabase
    .from('partner_wallet_balances')
    .select('balance')
    .eq('wallet_id', sellerWalletId)
    .eq('token', escrow.token)
    .single();

  if (existingBalance) {
    await supabase
      .from('partner_wallet_balances')
      .update({ balance: parseFloat(existingBalance.balance) + parseFloat(escrow.amount) })
      .eq('wallet_id', sellerWalletId)
      .eq('token', escrow.token);
  } else {
    await supabase
      .from('partner_wallet_balances')
      .insert({ wallet_id: sellerWalletId, token: escrow.token, balance: parseFloat(escrow.amount) });
  }

  // Update escrow
  const { data: updatedEscrow, error: updateError } = await supabase
    .from('partner_escrows')
    .update({ 
      status: 'released', 
      released_at: new Date().toISOString(),
      seller_wallet_id: sellerWalletId
    })
    .eq('id', escrowId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update escrow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Log transaction
  await supabase.from('partner_transactions').insert({
    partner_id: partnerId,
    destination_wallet_id: sellerWalletId,
    amount: parseFloat(escrow.amount),
    token: escrow.token,
    transaction_type: 'escrow_release',
    status: 'completed',
    external_reference: escrowId,
  });

  await triggerWebhook(supabase, partnerId, 'escrow.released', updatedEscrow);

  return new Response(JSON.stringify({ success: true, escrow: updatedEscrow }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function disputeEscrow(req: Request, supabase: any, partnerId: string, escrowId: string) {
  const body = await req.json();
  const { reason } = body;

  if (!reason) {
    return new Response(JSON.stringify({ error: 'Dispute reason is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: escrow, error: escrowError } = await supabase
    .from('partner_escrows')
    .select('*')
    .eq('id', escrowId)
    .eq('partner_id', partnerId)
    .single();

  if (escrowError || !escrow) {
    return new Response(JSON.stringify({ error: 'Escrow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (escrow.status !== 'funded') {
    return new Response(JSON.stringify({ error: `Cannot dispute escrow in ${escrow.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: updatedEscrow, error: updateError } = await supabase
    .from('partner_escrows')
    .update({ 
      status: 'disputed', 
      disputed_at: new Date().toISOString(),
      dispute_reason: reason
    })
    .eq('id', escrowId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update escrow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await triggerWebhook(supabase, partnerId, 'escrow.disputed', updatedEscrow);

  return new Response(JSON.stringify({ success: true, escrow: updatedEscrow }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function refundEscrow(req: Request, supabase: any, partnerId: string, escrowId: string) {
  const { data: escrow, error: escrowError } = await supabase
    .from('partner_escrows')
    .select('*')
    .eq('id', escrowId)
    .eq('partner_id', partnerId)
    .single();

  if (escrowError || !escrow) {
    return new Response(JSON.stringify({ error: 'Escrow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['funded', 'disputed'].includes(escrow.status)) {
    return new Response(JSON.stringify({ error: `Cannot refund escrow in ${escrow.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Refund to buyer (amount + fee)
  const totalRefund = parseFloat(escrow.amount) + parseFloat(escrow.fee);
  
  const { data: existingBalance } = await supabase
    .from('partner_wallet_balances')
    .select('balance')
    .eq('wallet_id', escrow.buyer_wallet_id)
    .eq('token', escrow.token)
    .single();

  if (existingBalance) {
    await supabase
      .from('partner_wallet_balances')
      .update({ balance: parseFloat(existingBalance.balance) + totalRefund })
      .eq('wallet_id', escrow.buyer_wallet_id)
      .eq('token', escrow.token);
  } else {
    await supabase
      .from('partner_wallet_balances')
      .insert({ wallet_id: escrow.buyer_wallet_id, token: escrow.token, balance: totalRefund });
  }

  const { data: updatedEscrow, error: updateError } = await supabase
    .from('partner_escrows')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', escrowId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update escrow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Log transaction
  await supabase.from('partner_transactions').insert({
    partner_id: partnerId,
    destination_wallet_id: escrow.buyer_wallet_id,
    amount: totalRefund,
    token: escrow.token,
    transaction_type: 'escrow_refund',
    status: 'completed',
    external_reference: escrowId,
  });

  await triggerWebhook(supabase, partnerId, 'escrow.refunded', updatedEscrow);

  return new Response(JSON.stringify({ success: true, escrow: updatedEscrow }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getEscrow(supabase: any, partnerId: string, escrowId: string) {
  const { data: escrow, error } = await supabase
    .from('partner_escrows')
    .select('*, buyer_wallet:partner_wallets!buyer_wallet_id(*), seller_wallet:partner_wallets!seller_wallet_id(*)')
    .eq('id', escrowId)
    .eq('partner_id', partnerId)
    .single();

  if (error || !escrow) {
    return new Response(JSON.stringify({ error: 'Escrow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, escrow }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listEscrows(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('partner_escrows')
    .select('*', { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: escrows, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to list escrows' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    escrows, 
    pagination: { total: count, limit, offset } 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function triggerWebhook(supabase: any, partnerId: string, eventType: string, data: any) {
  try {
    const { data: webhooks } = await supabase
      .from('partner_webhooks')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    for (const webhook of webhooks || []) {
      await supabase.from('partner_webhook_logs').insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload: { event: eventType, data, timestamp: new Date().toISOString() },
        status: 'pending',
      });
    }
  } catch (error) {
    console.error('Webhook trigger error:', error);
  }
}
