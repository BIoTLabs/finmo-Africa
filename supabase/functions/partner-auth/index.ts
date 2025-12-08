import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

interface AuthResult {
  authenticated: boolean;
  partnerId?: string;
  partnerName?: string;
  environment?: string;
  scopes?: string[];
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing API key. Include x-api-key header.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the API key for lookup
    const { data: hashResult } = await supabase.rpc('hash_api_key', { _key: apiKey });
    const keyHash = hashResult;

    // Look up the API key
    const { data: apiKeyData, error: keyError } = await supabase
      .from('partner_api_keys')
      .select(`
        id,
        partner_id,
        environment,
        scopes,
        rate_limit_per_minute,
        daily_request_limit,
        is_active,
        expires_at,
        partners!inner (
          id,
          company_name,
          status,
          sandbox_enabled,
          production_enabled
        )
      `)
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !apiKeyData) {
      await logApiRequest(supabase, null, null, req, 401, startTime, 'Invalid API key');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if key is active
    if (!apiKeyData.is_active) {
      await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 401, startTime, 'API key is disabled');
      return new Response(
        JSON.stringify({ success: false, error: 'API key is disabled' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if key is expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 401, startTime, 'API key has expired');
      return new Response(
        JSON.stringify({ success: false, error: 'API key has expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const partner = apiKeyData.partners as any;

    // Check partner status
    if (partner.status !== 'approved') {
      await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 403, startTime, 'Partner account not approved');
      return new Response(
        JSON.stringify({ success: false, error: 'Partner account is not approved' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check environment access
    if (apiKeyData.environment === 'production' && !partner.production_enabled) {
      await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 403, startTime, 'Production access not enabled');
      return new Response(
        JSON.stringify({ success: false, error: 'Production access not enabled for this partner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(supabase, apiKeyData.id, apiKeyData.rate_limit_per_minute);
    if (!rateLimitCheck.allowed) {
      await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 429, startTime, 'Rate limit exceeded');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded',
          retry_after: rateLimitCheck.retryAfter
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last used timestamp
    await supabase
      .from('partner_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Log successful authentication
    await logApiRequest(supabase, apiKeyData.partner_id, apiKeyData.id, req, 200, startTime, null);

    const authResult: AuthResult = {
      authenticated: true,
      partnerId: apiKeyData.partner_id,
      partnerName: partner.company_name,
      environment: apiKeyData.environment,
      scopes: apiKeyData.scopes
    };

    return new Response(
      JSON.stringify({ success: true, data: authResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner auth error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkRateLimit(
  supabase: any, 
  apiKeyId: string, 
  limitPerMinute: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  
  const { count } = await supabase
    .from('partner_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', oneMinuteAgo);

  if (count >= limitPerMinute) {
    return { allowed: false, retryAfter: 60 };
  }

  return { allowed: true };
}

async function logApiRequest(
  supabase: any,
  partnerId: string | null,
  apiKeyId: string | null,
  req: Request,
  status: number,
  startTime: number,
  error: string | null
) {
  try {
    const url = new URL(req.url);
    await supabase.from('partner_api_logs').insert({
      partner_id: partnerId,
      api_key_id: apiKeyId,
      endpoint: url.pathname,
      method: req.method,
      response_status: status,
      response_time_ms: Date.now() - startTime,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });
  } catch (e) {
    console.error('Failed to log API request:', e);
  }
}
