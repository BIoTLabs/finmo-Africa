import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

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
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!;
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
      // POST /partner-wallets - Create wallet
      if (!scopes.includes('wallets:write')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: wallets:write' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await createWallet(req, supabase, partnerId, encryptionKey);
    }

    if (req.method === 'GET' && pathParts.length === 1) {
      // GET /partner-wallets - List wallets
      if (!scopes.includes('wallets:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: wallets:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await listWallets(req, supabase, partnerId);
    }

    if (req.method === 'GET' && pathParts.length === 2) {
      // GET /partner-wallets/:id - Get wallet details
      if (!scopes.includes('wallets:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: wallets:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getWallet(supabase, partnerId, pathParts[1]);
    }

    if (req.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'transactions') {
      // GET /partner-wallets/:id/transactions - Get wallet transactions
      if (!scopes.includes('wallets:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: wallets:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getWalletTransactions(req, supabase, partnerId, pathParts[1]);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner wallets error:', error);
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

  if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
    return { success: false, status: 401, error: 'API key has expired' };
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

async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  
  // Derive a proper 256-bit key from the encryption key using SHA-256
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(encryptionKey)
  );
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Generate a random 12-byte IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the private key using AES-256-GCM
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function createWallet(req: Request, supabase: any, partnerId: string, encryptionKey: string) {
  const body = await req.json();
  const { external_customer_id, label, metadata } = body;

  if (!external_customer_id) {
    return new Response(
      JSON.stringify({ success: false, error: 'external_customer_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if wallet already exists for this customer
  const { data: existing } = await supabase
    .from('partner_wallets')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('external_customer_id', external_customer_id)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ success: false, error: 'Wallet already exists for this customer' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate new wallet
  const wallet = ethers.Wallet.createRandom();
  const encryptedKey = await encryptPrivateKey(wallet.privateKey, encryptionKey);

  // Create wallet record
  const { data: newWallet, error } = await supabase
    .from('partner_wallets')
    .insert({
      partner_id: partnerId,
      external_customer_id,
      wallet_address: wallet.address,
      wallet_private_key_encrypted: encryptedKey,
      label,
      metadata: metadata || {}
    })
    .select('id, external_customer_id, wallet_address, label, metadata, created_at')
    .single();

  if (error) {
    console.error('Failed to create wallet:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create wallet' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize balances for common tokens
  const tokens = ['USDC', 'USDT', 'MATIC'];
  for (const token of tokens) {
    await supabase.from('partner_wallet_balances').insert({
      wallet_id: newWallet.id,
      token,
      balance: 0
    });
  }

  console.log(`Created partner wallet ${newWallet.id} for partner ${partnerId}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        id: newWallet.id,
        external_customer_id: newWallet.external_customer_id,
        wallet_address: newWallet.wallet_address,
        label: newWallet.label,
        metadata: newWallet.metadata,
        created_at: newWallet.created_at
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listWallets(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const { data: wallets, error, count } = await supabase
    .from('partner_wallets')
    .select(`
      id,
      external_customer_id,
      wallet_address,
      label,
      metadata,
      is_active,
      created_at,
      partner_wallet_balances (
        token,
        balance
      )
    `, { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch wallets' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const formattedWallets = wallets.map((w: any) => ({
    id: w.id,
    external_customer_id: w.external_customer_id,
    wallet_address: w.wallet_address,
    label: w.label,
    metadata: w.metadata,
    is_active: w.is_active,
    created_at: w.created_at,
    balances: w.partner_wallet_balances.reduce((acc: any, b: any) => {
      acc[b.token] = parseFloat(b.balance);
      return acc;
    }, {})
  }));

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: formattedWallets,
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

async function getWallet(supabase: any, partnerId: string, walletId: string) {
  const { data: wallet, error } = await supabase
    .from('partner_wallets')
    .select(`
      id,
      external_customer_id,
      wallet_address,
      label,
      metadata,
      is_active,
      created_at,
      partner_wallet_balances (
        token,
        balance
      )
    `)
    .eq('partner_id', partnerId)
    .eq('id', walletId)
    .maybeSingle();

  if (error || !wallet) {
    return new Response(
      JSON.stringify({ success: false, error: 'Wallet not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        id: wallet.id,
        external_customer_id: wallet.external_customer_id,
        wallet_address: wallet.wallet_address,
        label: wallet.label,
        metadata: wallet.metadata,
        is_active: wallet.is_active,
        created_at: wallet.created_at,
        balances: wallet.partner_wallet_balances.reduce((acc: any, b: any) => {
          acc[b.token] = parseFloat(b.balance);
          return acc;
        }, {})
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getWalletTransactions(req: Request, supabase: any, partnerId: string, walletId: string) {
  // First verify wallet belongs to partner
  const { data: wallet } = await supabase
    .from('partner_wallets')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('id', walletId)
    .maybeSingle();

  if (!wallet) {
    return new Response(
      JSON.stringify({ success: false, error: 'Wallet not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  const { data: transactions, error, count } = await supabase
    .from('partner_transactions')
    .select('*', { count: 'exact' })
    .or(`source_wallet_id.eq.${walletId},destination_wallet_id.eq.${walletId}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch transactions' }),
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
