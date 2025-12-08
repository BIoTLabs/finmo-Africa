import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate partner
    const authResult = await authenticatePartner(req, supabase);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { partnerId, scopes } = authResult;
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Route handling
    if (req.method === 'POST' && pathParts.length === 1) {
      // POST /partner-transfers - Create transfer
      if (!scopes.includes('transfers:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: transfers:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await createTransfer(req, supabase, partnerId);
    }

    if (req.method === 'GET' && pathParts.length === 1) {
      // GET /partner-transfers - List transfers
      if (!scopes.includes('transfers:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: transfers:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await listTransfers(req, supabase, partnerId);
    }

    if (req.method === 'GET' && pathParts.length === 2) {
      // GET /partner-transfers/:id - Get transfer details
      if (!scopes.includes('transfers:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: transfers:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getTransfer(supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'batch') {
      // POST /partner-transfers/batch - Batch transfers
      if (!scopes.includes('transfers:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: transfers:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await createBatchTransfers(req, supabase, partnerId);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner transfers error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function authenticatePartner(req: Request, supabase: any) {
  const apiKey = req.headers.get('x-api-key');
  
  if (!apiKey) {
    return { success: false, status: 401, error: 'Missing API key' };
  }

  const { data: hashResult } = await supabase.rpc('hash_api_key', { _key: apiKey });
  
  const { data: apiKeyData, error } = await supabase
    .from('partner_api_keys')
    .select(`
      id,
      partner_id,
      scopes,
      is_active,
      expires_at,
      partners!inner (status)
    `)
    .eq('key_hash', hashResult)
    .single();

  if (error || !apiKeyData) {
    return { success: false, status: 401, error: 'Invalid API key' };
  }

  if (!apiKeyData.is_active) {
    return { success: false, status: 401, error: 'API key is disabled' };
  }

  const partner = apiKeyData.partners as any;
  if (partner.status !== 'approved') {
    return { success: false, status: 403, error: 'Partner account not approved' };
  }

  return { 
    success: true, 
    partnerId: apiKeyData.partner_id, 
    scopes: apiKeyData.scopes || []
  };
}

async function createTransfer(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { 
    source_wallet_id, 
    destination_wallet_id, 
    amount, 
    token, 
    external_reference,
    metadata 
  } = body;

  // Validate required fields
  if (!source_wallet_id || !destination_wallet_id || !amount || !token) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'source_wallet_id, destination_wallet_id, amount, and token are required' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (amount <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Amount must be greater than 0' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify source wallet belongs to partner and has sufficient balance
  const { data: sourceWallet, error: sourceError } = await supabase
    .from('partner_wallets')
    .select(`
      id,
      wallet_address,
      partner_wallet_balances!inner (
        token,
        balance
      )
    `)
    .eq('partner_id', partnerId)
    .eq('id', source_wallet_id)
    .eq('partner_wallet_balances.token', token)
    .maybeSingle();

  if (sourceError || !sourceWallet) {
    return new Response(
      JSON.stringify({ success: false, error: 'Source wallet not found or token not supported' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const sourceBalance = parseFloat(sourceWallet.partner_wallet_balances[0]?.balance || '0');
  if (sourceBalance < amount) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Insufficient balance',
        available: sourceBalance,
        requested: amount
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify destination wallet belongs to partner
  const { data: destWallet, error: destError } = await supabase
    .from('partner_wallets')
    .select('id, wallet_address')
    .eq('partner_id', partnerId)
    .eq('id', destination_wallet_id)
    .maybeSingle();

  if (destError || !destWallet) {
    return new Response(
      JSON.stringify({ success: false, error: 'Destination wallet not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate fee (0.1% for internal transfers)
  const fee = amount * 0.001;
  const netAmount = amount - fee;

  // Deduct from source
  await supabase
    .from('partner_wallet_balances')
    .update({ 
      balance: sourceBalance - amount,
      updated_at: new Date().toISOString()
    })
    .eq('wallet_id', source_wallet_id)
    .eq('token', token);

  // Add to destination (get current balance first)
  const { data: destBalanceData } = await supabase
    .from('partner_wallet_balances')
    .select('balance')
    .eq('wallet_id', destination_wallet_id)
    .eq('token', token)
    .maybeSingle();

  if (destBalanceData) {
    await supabase
      .from('partner_wallet_balances')
      .update({ 
        balance: parseFloat(destBalanceData.balance) + netAmount,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_id', destination_wallet_id)
      .eq('token', token);
  } else {
    await supabase
      .from('partner_wallet_balances')
      .insert({
        wallet_id: destination_wallet_id,
        token,
        balance: netAmount
      });
  }

  // Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from('partner_transactions')
    .insert({
      partner_id: partnerId,
      source_wallet_id,
      destination_wallet_id,
      external_reference,
      transaction_type: 'internal',
      amount,
      token,
      fee,
      status: 'completed',
      metadata: metadata || {},
      completed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (txError) {
    console.error('Failed to create transaction record:', txError);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create transaction' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Trigger webhook
  await triggerWebhook(supabase, partnerId, 'transfer.completed', {
    transaction_id: transaction.id,
    amount,
    token,
    fee,
    net_amount: netAmount,
    source_wallet_id,
    destination_wallet_id
  });

  console.log(`Partner transfer completed: ${transaction.id} - ${amount} ${token}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        id: transaction.id,
        amount,
        token,
        fee,
        net_amount: netAmount,
        status: 'completed',
        source_wallet_id,
        destination_wallet_id,
        external_reference,
        created_at: transaction.created_at
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listTransfers(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status');
  const token = url.searchParams.get('token');

  let query = supabase
    .from('partner_transactions')
    .select('*', { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (token) {
    query = query.eq('token', token);
  }

  const { data: transactions, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch transfers' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: transactions,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil((count || 0) / limit)
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getTransfer(supabase: any, partnerId: string, transferId: string) {
  const { data: transaction, error } = await supabase
    .from('partner_transactions')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('id', transferId)
    .maybeSingle();

  if (error || !transaction) {
    return new Response(
      JSON.stringify({ success: false, error: 'Transfer not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: transaction }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function createBatchTransfers(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { transfers } = body;

  if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'transfers array is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (transfers.length > 100) {
    return new Response(
      JSON.stringify({ success: false, error: 'Maximum 100 transfers per batch' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results: any[] = [];

  for (const transfer of transfers) {
    try {
      const mockReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(transfer)
      });
      
      const response = await createTransfer(mockReq, supabase, partnerId);
      const result = await response.json();
      
      results.push({
        external_reference: transfer.external_reference,
        success: result.success,
        data: result.data,
        error: result.error
      });
    } catch (error) {
      results.push({
        external_reference: transfer.external_reference,
        success: false,
        error: 'Processing failed'
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        total: transfers.length,
        successful: successCount,
        failed: transfers.length - successCount,
        results
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function triggerWebhook(supabase: any, partnerId: string, eventType: string, payload: any) {
  try {
    const { data: webhooks } = await supabase
      .from('partner_webhooks')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    for (const webhook of webhooks) {
      const timestamp = Date.now();
      const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
      
      // Create signature using webhook secret
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signaturePayload)
      );
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Send webhook
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Finmo-Signature': `t=${timestamp},v1=${signatureHex}`,
            'X-Finmo-Event': eventType
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
          })
        });

        // Log webhook delivery
        await supabase.from('partner_webhook_logs').insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload,
          response_status: response.status,
          delivered_at: response.ok ? new Date().toISOString() : null
        });
      } catch (e) {
        await supabase.from('partner_webhook_logs').insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload,
          response_status: 0,
          response_body: String(e)
        });
      }
    }
  } catch (e) {
    console.error('Webhook trigger error:', e);
  }
}
