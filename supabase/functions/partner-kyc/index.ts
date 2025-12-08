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
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate partner
    const authResult = await authenticatePartner(req, supabase);
    if (!authResult.success) {
      return authResult.response!;
    }

    const { partnerId, scopes } = authResult;
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const kycId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Check scopes
    if (!scopes?.includes('kyc:read') && !scopes?.includes('kyc:write')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions for KYC operations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route requests
    if (req.method === 'GET' && !kycId) {
      return await listKYCVerifications(req, supabase, partnerId!);
    } else if (req.method === 'GET' && kycId && !action) {
      return await getKYCVerification(supabase, partnerId!, kycId);
    } else if (req.method === 'POST' && !kycId) {
      if (!scopes?.includes('kyc:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await initiateKYC(req, supabase, partnerId!, encryptionKey);
    } else if (req.method === 'POST' && kycId && action === 'documents') {
      if (!scopes?.includes('kyc:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await uploadDocuments(req, supabase, partnerId!, kycId);
    } else if (req.method === 'PUT' && kycId && action === 'submit') {
      if (!scopes?.includes('kyc:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await submitForReview(supabase, partnerId!, kycId);
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Partner KYC error:', error);
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

  if (!apiKeyData.is_active || apiKeyData.partners?.status !== 'approved') {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: 'API key inactive or partner not approved' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  return { success: true, partnerId: apiKeyData.partner_id, scopes: apiKeyData.scopes };
}

function encryptData(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = dataBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

async function initiateKYC(req: Request, supabase: any, partnerId: string, encryptionKey: string) {
  const body = await req.json();
  const { 
    external_customer_id, 
    verification_level, 
    first_name, 
    last_name, 
    date_of_birth,
    nationality,
    address,
    document_type,
    document_number,
    metadata 
  } = body;

  if (!external_customer_id) {
    return new Response(JSON.stringify({ error: 'external_customer_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check for existing pending/in_review KYC for this customer
  const { data: existingKYC } = await supabase
    .from('partner_kyc_verifications')
    .select('id, status')
    .eq('partner_id', partnerId)
    .eq('external_customer_id', external_customer_id)
    .in('status', ['pending', 'in_review'])
    .single();

  if (existingKYC) {
    return new Response(JSON.stringify({ 
      error: 'Active KYC verification already exists',
      existing_kyc_id: existingKYC.id,
      status: existingKYC.status
    }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: kyc, error } = await supabase
    .from('partner_kyc_verifications')
    .insert({
      partner_id: partnerId,
      external_customer_id,
      verification_level: verification_level || 'basic',
      first_name,
      last_name,
      date_of_birth,
      nationality,
      address,
      document_type,
      document_number_encrypted: document_number ? encryptData(document_number, encryptionKey) : null,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Initiate KYC error:', error);
    return new Response(JSON.stringify({ error: 'Failed to initiate KYC' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get required documents based on verification level
  const requiredDocuments = getRequiredDocuments(verification_level || 'basic');

  await triggerWebhook(supabase, partnerId, 'kyc.initiated', { 
    kyc_id: kyc.id, 
    external_customer_id,
    verification_level: kyc.verification_level
  });

  return new Response(JSON.stringify({ 
    success: true, 
    kyc: { ...kyc, document_number_encrypted: undefined },
    required_documents: requiredDocuments,
    next_steps: [
      'Upload required documents using POST /partner-kyc/{id}/documents',
      'Submit for review using PUT /partner-kyc/{id}/submit'
    ]
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getRequiredDocuments(level: string): string[] {
  switch (level) {
    case 'basic':
      return ['government_id_front'];
    case 'standard':
      return ['government_id_front', 'government_id_back', 'selfie'];
    case 'enhanced':
      return ['government_id_front', 'government_id_back', 'selfie', 'proof_of_address', 'utility_bill'];
    default:
      return ['government_id_front'];
  }
}

async function uploadDocuments(req: Request, supabase: any, partnerId: string, kycId: string) {
  const body = await req.json();
  const { document_front_url, document_back_url, selfie_url } = body;

  // Verify KYC belongs to partner
  const { data: kyc, error: kycError } = await supabase
    .from('partner_kyc_verifications')
    .select('*')
    .eq('id', kycId)
    .eq('partner_id', partnerId)
    .single();

  if (kycError || !kyc) {
    return new Response(JSON.stringify({ error: 'KYC verification not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (kyc.status !== 'pending') {
    return new Response(JSON.stringify({ error: `Cannot upload documents for KYC in ${kyc.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const updateData: any = {};
  if (document_front_url) updateData.document_front_url = document_front_url;
  if (document_back_url) updateData.document_back_url = document_back_url;
  if (selfie_url) updateData.selfie_url = selfie_url;

  if (Object.keys(updateData).length === 0) {
    return new Response(JSON.stringify({ error: 'At least one document URL is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: updatedKYC, error: updateError } = await supabase
    .from('partner_kyc_verifications')
    .update(updateData)
    .eq('id', kycId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update documents' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await triggerWebhook(supabase, partnerId, 'kyc.documents_uploaded', { kyc_id: kycId });

  return new Response(JSON.stringify({ 
    success: true, 
    kyc: { ...updatedKYC, document_number_encrypted: undefined }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function submitForReview(supabase: any, partnerId: string, kycId: string) {
  const { data: kyc, error: kycError } = await supabase
    .from('partner_kyc_verifications')
    .select('*')
    .eq('id', kycId)
    .eq('partner_id', partnerId)
    .single();

  if (kycError || !kyc) {
    return new Response(JSON.stringify({ error: 'KYC verification not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (kyc.status !== 'pending') {
    return new Response(JSON.stringify({ error: `Cannot submit KYC in ${kyc.status} status` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate required documents are uploaded
  const requiredDocs = getRequiredDocuments(kyc.verification_level);
  const missingDocs: string[] = [];

  if (requiredDocs.includes('government_id_front') && !kyc.document_front_url) {
    missingDocs.push('government_id_front');
  }
  if (requiredDocs.includes('government_id_back') && !kyc.document_back_url) {
    missingDocs.push('government_id_back');
  }
  if (requiredDocs.includes('selfie') && !kyc.selfie_url) {
    missingDocs.push('selfie');
  }

  if (missingDocs.length > 0) {
    return new Response(JSON.stringify({ 
      error: 'Missing required documents',
      missing_documents: missingDocs
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: updatedKYC, error: updateError } = await supabase
    .from('partner_kyc_verifications')
    .update({ status: 'in_review' })
    .eq('id', kycId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to submit for review' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await triggerWebhook(supabase, partnerId, 'kyc.submitted', { kyc_id: kycId });

  return new Response(JSON.stringify({ 
    success: true, 
    kyc: { ...updatedKYC, document_number_encrypted: undefined },
    message: 'KYC verification submitted for review. You will be notified via webhook when the review is complete.'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getKYCVerification(supabase: any, partnerId: string, kycId: string) {
  const { data: kyc, error } = await supabase
    .from('partner_kyc_verifications')
    .select('*')
    .eq('id', kycId)
    .eq('partner_id', partnerId)
    .single();

  if (error || !kyc) {
    return new Response(JSON.stringify({ error: 'KYC verification not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    kyc: { ...kyc, document_number_encrypted: undefined }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listKYCVerifications(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const external_customer_id = url.searchParams.get('external_customer_id');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('partner_kyc_verifications')
    .select('*', { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (external_customer_id) {
    query = query.eq('external_customer_id', external_customer_id);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data: verifications, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to list KYC verifications' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Remove encrypted fields
  const sanitized = verifications.map((v: any) => ({ ...v, document_number_encrypted: undefined }));

  return new Response(JSON.stringify({ 
    success: true, 
    verifications: sanitized,
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
