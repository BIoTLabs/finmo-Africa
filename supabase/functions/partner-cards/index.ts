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
    const cardId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Check scopes
    if (!scopes?.includes('cards:read') && !scopes?.includes('cards:write')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions for card operations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route requests
    if (req.method === 'GET' && !cardId) {
      return await listCards(req, supabase, partnerId!);
    } else if (req.method === 'GET' && cardId && action === 'transactions') {
      return await getCardTransactions(req, supabase, partnerId!, cardId);
    } else if (req.method === 'GET' && cardId && !action) {
      return await getCard(supabase, partnerId!, cardId);
    } else if (req.method === 'POST' && !cardId) {
      if (!scopes?.includes('cards:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await issueCard(req, supabase, partnerId!, encryptionKey);
    } else if (req.method === 'POST' && cardId && action) {
      if (!scopes?.includes('cards:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      switch (action) {
        case 'fund':
          return await fundCard(req, supabase, partnerId!, cardId);
        case 'freeze':
          return await freezeCard(supabase, partnerId!, cardId, true);
        case 'unfreeze':
          return await freezeCard(supabase, partnerId!, cardId, false);
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }
    } else if (req.method === 'PUT' && cardId && action === 'limit') {
      if (!scopes?.includes('cards:write')) {
        return new Response(JSON.stringify({ error: 'Write permission required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await updateSpendingLimit(req, supabase, partnerId!, cardId);
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Partner cards error:', error);
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

function generateCardNumber(): string {
  // Generate a 16-digit card number starting with 4 (Visa-like)
  let cardNumber = '4';
  for (let i = 0; i < 15; i++) {
    cardNumber += Math.floor(Math.random() * 10).toString();
  }
  return cardNumber;
}

function generateCVV(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

function encryptData(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = dataBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

function decryptData(encrypted: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
  const decoded = atob(encrypted);
  const decrypted = Array.from(decoded).map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ keyBytes[i % keyBytes.length])
  ).join('');
  return decrypted;
}

async function issueCard(req: Request, supabase: any, partnerId: string, encryptionKey: string) {
  const body = await req.json();
  const { wallet_id, external_customer_id, card_holder_name, spending_limit, currency, metadata } = body;

  if (!wallet_id || !external_customer_id || !card_holder_name) {
    return new Response(JSON.stringify({ error: 'wallet_id, external_customer_id, and card_holder_name are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify wallet belongs to partner
  const { data: wallet, error: walletError } = await supabase
    .from('partner_wallets')
    .select('id, partner_id')
    .eq('id', wallet_id)
    .eq('partner_id', partnerId)
    .single();

  if (walletError || !wallet) {
    return new Response(JSON.stringify({ error: 'Wallet not found or does not belong to partner' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate card details
  const cardNumber = generateCardNumber();
  const cvv = generateCVV();
  const expiryMonth = new Date().getMonth() + 1;
  const expiryYear = new Date().getFullYear() + 3;

  const { data: card, error } = await supabase
    .from('partner_cards')
    .insert({
      partner_id: partnerId,
      wallet_id,
      external_customer_id,
      card_number_encrypted: encryptData(cardNumber, encryptionKey),
      cvv_encrypted: encryptData(cvv, encryptionKey),
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      card_holder_name,
      spending_limit: spending_limit || 1000,
      currency: currency || 'USD',
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Issue card error:', error);
    return new Response(JSON.stringify({ error: 'Failed to issue card' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Return card with masked number and full CVV (only shown once)
  const response = {
    ...card,
    card_number_masked: `**** **** **** ${cardNumber.slice(-4)}`,
    card_number: cardNumber, // Only returned on creation
    cvv: cvv, // Only returned on creation
    card_number_encrypted: undefined,
    cvv_encrypted: undefined,
  };

  await triggerWebhook(supabase, partnerId, 'card.issued', { card_id: card.id, external_customer_id });

  return new Response(JSON.stringify({ success: true, card: response }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fundCard(req: Request, supabase: any, partnerId: string, cardId: string) {
  const body = await req.json();
  const { amount } = body;

  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Valid amount is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: card, error: cardError } = await supabase
    .from('partner_cards')
    .select('*, wallet:partner_wallets(*)')
    .eq('id', cardId)
    .eq('partner_id', partnerId)
    .single();

  if (cardError || !card) {
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!card.is_active) {
    return new Response(JSON.stringify({ error: 'Card is not active' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check wallet balance (assuming USDC for now)
  const { data: balance } = await supabase
    .from('partner_wallet_balances')
    .select('balance')
    .eq('wallet_id', card.wallet_id)
    .eq('token', 'USDC')
    .single();

  if (!balance || parseFloat(balance.balance) < amount) {
    return new Response(JSON.stringify({ error: 'Insufficient wallet balance' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deduct from wallet
  await supabase
    .from('partner_wallet_balances')
    .update({ balance: parseFloat(balance.balance) - amount })
    .eq('wallet_id', card.wallet_id)
    .eq('token', 'USDC');

  // Add to card balance
  const { data: updatedCard, error: updateError } = await supabase
    .from('partner_cards')
    .update({ balance: parseFloat(card.balance) + amount })
    .eq('id', cardId)
    .select()
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to fund card' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Log transaction
  await supabase.from('partner_card_transactions').insert({
    card_id: cardId,
    partner_id: partnerId,
    amount,
    transaction_type: 'fund',
    status: 'completed',
  });

  await triggerWebhook(supabase, partnerId, 'card.funded', { card_id: cardId, amount });

  return new Response(JSON.stringify({ 
    success: true, 
    card: { ...updatedCard, card_number_encrypted: undefined, cvv_encrypted: undefined },
    new_balance: updatedCard.balance
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function freezeCard(supabase: any, partnerId: string, cardId: string, freeze: boolean) {
  const { data: card, error: updateError } = await supabase
    .from('partner_cards')
    .update({ is_frozen: freeze })
    .eq('id', cardId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (updateError || !card) {
    return new Response(JSON.stringify({ error: 'Card not found or update failed' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await triggerWebhook(supabase, partnerId, freeze ? 'card.frozen' : 'card.unfrozen', { card_id: cardId });

  return new Response(JSON.stringify({ 
    success: true, 
    card: { ...card, card_number_encrypted: undefined, cvv_encrypted: undefined },
    is_frozen: freeze 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateSpendingLimit(req: Request, supabase: any, partnerId: string, cardId: string) {
  const body = await req.json();
  const { spending_limit } = body;

  if (!spending_limit || spending_limit < 0) {
    return new Response(JSON.stringify({ error: 'Valid spending_limit is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: card, error: updateError } = await supabase
    .from('partner_cards')
    .update({ spending_limit })
    .eq('id', cardId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (updateError || !card) {
    return new Response(JSON.stringify({ error: 'Card not found or update failed' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    card: { ...card, card_number_encrypted: undefined, cvv_encrypted: undefined }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCard(supabase: any, partnerId: string, cardId: string) {
  const { data: card, error } = await supabase
    .from('partner_cards')
    .select('*')
    .eq('id', cardId)
    .eq('partner_id', partnerId)
    .single();

  if (error || !card) {
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mask card number
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
  const cardNumber = decryptData(card.card_number_encrypted, encryptionKey);

  return new Response(JSON.stringify({ 
    success: true, 
    card: {
      ...card,
      card_number_masked: `**** **** **** ${cardNumber.slice(-4)}`,
      card_number_encrypted: undefined,
      cvv_encrypted: undefined,
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listCards(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const external_customer_id = url.searchParams.get('external_customer_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('partner_cards')
    .select('*', { count: 'exact' })
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (external_customer_id) {
    query = query.eq('external_customer_id', external_customer_id);
  }

  const { data: cards, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to list cards' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mask card numbers
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
  const maskedCards = cards.map((card: any) => {
    const cardNumber = decryptData(card.card_number_encrypted, encryptionKey);
    return {
      ...card,
      card_number_masked: `**** **** **** ${cardNumber.slice(-4)}`,
      card_number_encrypted: undefined,
      cvv_encrypted: undefined,
    };
  });

  return new Response(JSON.stringify({ 
    success: true, 
    cards: maskedCards,
    pagination: { total: count, limit, offset }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCardTransactions(req: Request, supabase: any, partnerId: string, cardId: string) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Verify card belongs to partner
  const { data: card } = await supabase
    .from('partner_cards')
    .select('id')
    .eq('id', cardId)
    .eq('partner_id', partnerId)
    .single();

  if (!card) {
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: transactions, error, count } = await supabase
    .from('partner_card_transactions')
    .select('*', { count: 'exact' })
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to list transactions' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    transactions,
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
