import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

const SUPPORTED_EVENTS = [
  'wallet.created',
  'wallet.updated',
  'transfer.initiated',
  'transfer.completed',
  'transfer.failed',
  'payout.initiated',
  'payout.completed',
  'payout.failed',
  'payin.received',
  'payin.confirmed'
];

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
    if (req.method === 'GET' && pathParts.length === 1) {
      // GET /partner-webhooks - List webhooks
      return await listWebhooks(supabase, partnerId);
    }

    if (req.method === 'POST' && pathParts.length === 1) {
      // POST /partner-webhooks - Create webhook
      if (!scopes.includes('webhooks:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: webhooks:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await createWebhook(req, supabase, partnerId);
    }

    if (req.method === 'GET' && pathParts.length === 2) {
      // GET /partner-webhooks/:id - Get webhook
      return await getWebhook(supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'PUT' && pathParts.length === 2) {
      // PUT /partner-webhooks/:id - Update webhook
      if (!scopes.includes('webhooks:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: webhooks:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await updateWebhook(req, supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'DELETE' && pathParts.length === 2) {
      // DELETE /partner-webhooks/:id - Delete webhook
      if (!scopes.includes('webhooks:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: webhooks:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await deleteWebhook(supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'logs') {
      // GET /partner-webhooks/:id/logs - Get webhook delivery logs
      return await getWebhookLogs(req, supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'test') {
      // POST /partner-webhooks/:id/test - Test webhook
      if (!scopes.includes('webhooks:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: webhooks:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await testWebhook(supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'events') {
      // GET /partner-webhooks/events - List supported events
      return new Response(
        JSON.stringify({ success: true, data: SUPPORTED_EVENTS }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner webhooks error:', error);
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

function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function listWebhooks(supabase: any, partnerId: string) {
  const { data: webhooks, error } = await supabase
    .from('partner_webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch webhooks' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: webhooks }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function createWebhook(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { url, events } = body;

  if (!url) {
    return new Response(
      JSON.stringify({ success: false, error: 'url is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid URL format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'events array is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate events
  const invalidEvents = events.filter((e: string) => !SUPPORTED_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        supported_events: SUPPORTED_EVENTS
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const secret = generateSecret();

  const { data: webhook, error } = await supabase
    .from('partner_webhooks')
    .insert({
      partner_id: partnerId,
      url,
      events,
      secret
    })
    .select('id, url, events, is_active, created_at')
    .single();

  if (error) {
    console.error('Failed to create webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        ...webhook,
        secret // Only returned on creation
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getWebhook(supabase: any, partnerId: string, webhookId: string) {
  const { data: webhook, error } = await supabase
    .from('partner_webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('partner_id', partnerId)
    .eq('id', webhookId)
    .maybeSingle();

  if (error || !webhook) {
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: webhook }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateWebhook(req: Request, supabase: any, partnerId: string, webhookId: string) {
  const body = await req.json();
  const { url, events, is_active } = body;

  const updates: any = {};
  
  if (url !== undefined) {
    try {
      new URL(url);
      updates.url = url;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'events must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const invalidEvents = events.filter((e: string) => !SUPPORTED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid events: ${invalidEvents.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    updates.events = events;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'No valid updates provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: webhook, error } = await supabase
    .from('partner_webhooks')
    .update(updates)
    .eq('partner_id', partnerId)
    .eq('id', webhookId)
    .select('id, url, events, is_active, created_at')
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found or update failed' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: webhook }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteWebhook(supabase: any, partnerId: string, webhookId: string) {
  const { error } = await supabase
    .from('partner_webhooks')
    .delete()
    .eq('partner_id', partnerId)
    .eq('id', webhookId);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found or delete failed' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Webhook deleted' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getWebhookLogs(req: Request, supabase: any, partnerId: string, webhookId: string) {
  // Verify webhook belongs to partner
  const { data: webhook } = await supabase
    .from('partner_webhooks')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('id', webhookId)
    .maybeSingle();

  if (!webhook) {
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const { data: logs, error, count } = await supabase
    .from('partner_webhook_logs')
    .select('*', { count: 'exact' })
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch logs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: logs,
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

async function testWebhook(supabase: any, partnerId: string, webhookId: string) {
  const { data: webhook, error } = await supabase
    .from('partner_webhooks')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('id', webhookId)
    .maybeSingle();

  if (error || !webhook) {
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const testPayload = {
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Finmo Africa Partner API'
    }
  };

  const timestamp = Date.now();
  const signaturePayload = `${timestamp}.${JSON.stringify(testPayload)}`;
  
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

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Finmo-Signature': `t=${timestamp},v1=${signatureHex}`,
        'X-Finmo-Event': 'test.ping'
      },
      body: JSON.stringify(testPayload)
    });

    const responseBody = await response.text();

    // Log the test
    await supabase.from('partner_webhook_logs').insert({
      webhook_id: webhookId,
      event_type: 'test.ping',
      payload: testPayload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      delivered_at: response.ok ? new Date().toISOString() : null
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          delivered: response.ok,
          response_status: response.status,
          response_body: responseBody.substring(0, 500)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    await supabase.from('partner_webhook_logs').insert({
      webhook_id: webhookId,
      event_type: 'test.ping',
      payload: testPayload,
      response_status: 0,
      response_body: String(e)
    });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to deliver webhook',
        details: String(e)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
