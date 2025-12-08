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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate partner
    const authResult = await authenticatePartner(req, supabase);
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { partnerId, scopes } = authResult;
    const url = new URL(req.url);
    const path = url.pathname.replace('/partner-payins', '');

    // Route handling
    if (req.method === 'POST' && path === '/address') {
      if (!scopes.includes('payins:write')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await generateDepositAddress(req, supabase, partnerId);
    }

    if (req.method === 'POST' && path === '/payment-link') {
      if (!scopes.includes('payins:write')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await createPaymentLink(req, supabase, partnerId);
    }

    if (req.method === 'GET' && path.startsWith('/')) {
      const payinId = path.slice(1);
      if (payinId) {
        return await getPayinStatus(supabase, partnerId, payinId);
      }
      return await listPayins(req, supabase, partnerId);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Partner payins error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function authenticatePartner(req: Request, supabase: any) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return { success: false, error: 'API key required', status: 401 };
  }

  // Hash the API key for comparison
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: keyData, error } = await supabase
    .from('partner_api_keys')
    .select('*, partners(*)')
    .eq('key_hash', keyHash)
    .single();

  if (error || !keyData) {
    return { success: false, error: 'Invalid API key', status: 401 };
  }

  if (!keyData.is_active) {
    return { success: false, error: 'API key is inactive', status: 401 };
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return { success: false, error: 'API key has expired', status: 401 };
  }

  if (keyData.partners.status !== 'approved') {
    return { success: false, error: 'Partner account not approved', status: 403 };
  }

  return {
    success: true,
    partnerId: keyData.partner_id,
    scopes: keyData.scopes || [],
  };
}

async function generateDepositAddress(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { external_customer_id, token, label, metadata } = body;

  if (!external_customer_id) {
    return new Response(JSON.stringify({ error: 'external_customer_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if wallet already exists for this customer
  const { data: existingWallet } = await supabase
    .from('partner_wallets')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('external_customer_id', external_customer_id)
    .single();

  if (existingWallet) {
    // Return existing wallet address
    const { data: balances } = await supabase
      .from('partner_wallet_balances')
      .select('*')
      .eq('wallet_id', existingWallet.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        wallet_id: existingWallet.id,
        address: existingWallet.wallet_address,
        external_customer_id: existingWallet.external_customer_id,
        label: existingWallet.label,
        balances: balances || [],
        is_new: false,
        created_at: existingWallet.created_at,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate new wallet
  const wallet = ethers.Wallet.createRandom();
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
  const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, encryptionKey);

  // Create wallet record
  const { data: newWallet, error: walletError } = await supabase
    .from('partner_wallets')
    .insert({
      partner_id: partnerId,
      external_customer_id,
      wallet_address: wallet.address,
      wallet_private_key_encrypted: encryptedPrivateKey,
      label: label || `Deposit wallet for ${external_customer_id}`,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (walletError) {
    console.error('Wallet creation error:', walletError);
    return new Response(JSON.stringify({ error: 'Failed to create deposit address' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize balances for common tokens
  const tokens = token ? [token] : ['USDC', 'USDT', 'DAI'];
  for (const t of tokens) {
    await supabase.from('partner_wallet_balances').insert({
      wallet_id: newWallet.id,
      token: t,
      balance: 0,
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      wallet_id: newWallet.id,
      address: wallet.address,
      external_customer_id,
      label: newWallet.label,
      supported_tokens: tokens,
      is_new: true,
      created_at: newWallet.created_at,
    }
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function encryptPrivateKey(privateKey: string, encryptionKey: string): string {
  const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
  const dataBytes = new TextEncoder().encode(privateKey);
  const encrypted = dataBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

async function createPaymentLink(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { amount, token, external_customer_id, description, expires_in_minutes, redirect_url, metadata } = body;

  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Valid amount is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate or get deposit address for customer
  let walletAddress: string;
  let walletId: string;

  if (external_customer_id) {
    const { data: existingWallet } = await supabase
      .from('partner_wallets')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('external_customer_id', external_customer_id)
      .single();

    if (existingWallet) {
      walletAddress = existingWallet.wallet_address;
      walletId = existingWallet.id;
    } else {
      // Create new wallet
      const wallet = ethers.Wallet.createRandom();
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
      const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, encryptionKey);

      const { data: newWallet, error } = await supabase
        .from('partner_wallets')
        .insert({
          partner_id: partnerId,
          external_customer_id,
          wallet_address: wallet.address,
          wallet_private_key_encrypted: encryptedPrivateKey,
          label: `Payment link wallet`,
          metadata: {},
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to create payment link' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      walletAddress = wallet.address;
      walletId = newWallet.id;
    }
  } else {
    // Create temporary wallet for one-time payment
    const wallet = ethers.Wallet.createRandom();
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, encryptionKey);

    const { data: newWallet, error } = await supabase
      .from('partner_wallets')
      .insert({
        partner_id: partnerId,
        external_customer_id: `payment_link_${Date.now()}`,
        wallet_address: wallet.address,
        wallet_private_key_encrypted: encryptedPrivateKey,
        label: `One-time payment`,
        metadata: { is_payment_link: true },
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to create payment link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    walletAddress = wallet.address;
    walletId = newWallet.id;
  }

  // Generate payment link ID
  const paymentLinkId = crypto.randomUUID();
  const expiresAt = expires_in_minutes 
    ? new Date(Date.now() + expires_in_minutes * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours default

  // Store payment link in wallet metadata
  await supabase
    .from('partner_wallets')
    .update({
      metadata: {
        payment_link_id: paymentLinkId,
        expected_amount: amount,
        expected_token: token || 'USDC',
        description,
        redirect_url,
        expires_at: expiresAt,
        ...metadata,
      }
    })
    .eq('id', walletId);

  // Generate payment link URL
  const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') || 'https://finmo.africa';
  const paymentUrl = `${baseUrl}/pay/${paymentLinkId}`;

  return new Response(JSON.stringify({
    success: true,
    data: {
      payment_link_id: paymentLinkId,
      payment_url: paymentUrl,
      deposit_address: walletAddress,
      amount,
      token: token || 'USDC',
      description,
      expires_at: expiresAt,
      status: 'pending',
    }
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPayinStatus(supabase: any, partnerId: string, payinId: string) {
  // Check if it's a wallet ID
  const { data: wallet, error } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)')
    .eq('id', payinId)
    .eq('partner_id', partnerId)
    .single();

  if (wallet) {
    return new Response(JSON.stringify({
      success: true,
      data: {
        wallet_id: wallet.id,
        address: wallet.wallet_address,
        external_customer_id: wallet.external_customer_id,
        label: wallet.label,
        balances: wallet.partner_wallet_balances,
        metadata: wallet.metadata,
        created_at: wallet.created_at,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if it's a payment link ID
  const { data: wallets } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)')
    .eq('partner_id', partnerId)
    .contains('metadata', { payment_link_id: payinId });

  if (wallets && wallets.length > 0) {
    const linkWallet = wallets[0];
    const metadata = linkWallet.metadata || {};
    const balance = linkWallet.partner_wallet_balances?.find(
      (b: any) => b.token === metadata.expected_token
    )?.balance || 0;

    return new Response(JSON.stringify({
      success: true,
      data: {
        payment_link_id: payinId,
        deposit_address: linkWallet.wallet_address,
        expected_amount: metadata.expected_amount,
        received_amount: balance,
        token: metadata.expected_token,
        status: balance >= metadata.expected_amount ? 'completed' : 'pending',
        expires_at: metadata.expires_at,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Pay-in not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listPayins(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { data: wallets, error, count } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)', { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch pay-ins' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: wallets.map((w: any) => ({
      wallet_id: w.id,
      address: w.wallet_address,
      external_customer_id: w.external_customer_id,
      label: w.label,
      balances: w.partner_wallet_balances,
      created_at: w.created_at,
    })),
    pagination: {
      total: count,
      limit,
      offset,
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
