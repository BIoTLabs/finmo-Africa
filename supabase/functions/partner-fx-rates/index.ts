import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

// Mock exchange rates - in production, integrate with actual price feeds
const CRYPTO_TO_USD: Record<string, number> = {
  'USDC': 1.00,
  'USDT': 1.00,
  'DAI': 1.00,
  'WBTC': 43500,
  'WETH': 2350,
  'MATIC': 0.85,
  'LINK': 14.50,
  'UNI': 7.20,
  'AAVE': 95.00
};

const USD_TO_FIAT: Record<string, number> = {
  'KES': 153.50,  // Kenyan Shilling
  'NGN': 1550.00, // Nigerian Naira
  'UGX': 3750.00, // Ugandan Shilling
  'TZS': 2500.00, // Tanzanian Shilling
  'GHS': 12.50,   // Ghanaian Cedi
  'ZAR': 18.50,   // South African Rand
  'RWF': 1250.00, // Rwandan Franc
  'USD': 1.00,
  'EUR': 0.92,
  'GBP': 0.79
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

    const { scopes } = authResult;
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Route handling
    if (req.method === 'GET' && pathParts.length === 1) {
      // GET /partner-fx-rates - Get all rates
      if (!scopes.includes('fx:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: fx:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return getAllRates(url);
    }

    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'convert') {
      // GET /partner-fx-rates/convert?from=USDC&to=KES&amount=100
      if (!scopes.includes('fx:read')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing scope: fx:read' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return convertCurrency(url);
    }

    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'pairs') {
      // GET /partner-fx-rates/pairs - List supported pairs
      return getSupportedPairs();
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner FX rates error:', error);
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

function getAllRates(url: URL) {
  const base = url.searchParams.get('base') || 'USD';
  const timestamp = new Date().toISOString();

  let rates: Record<string, number> = {};

  if (base === 'USD') {
    // USD to all currencies
    rates = { ...USD_TO_FIAT };
    for (const [crypto, usdValue] of Object.entries(CRYPTO_TO_USD)) {
      rates[crypto] = 1 / usdValue;
    }
  } else if (CRYPTO_TO_USD[base]) {
    // Crypto to all fiat
    const cryptoInUsd = CRYPTO_TO_USD[base];
    for (const [fiat, usdRate] of Object.entries(USD_TO_FIAT)) {
      rates[fiat] = cryptoInUsd * usdRate;
    }
  } else if (USD_TO_FIAT[base]) {
    // Fiat to all crypto
    const fiatPerUsd = USD_TO_FIAT[base];
    for (const [crypto, usdValue] of Object.entries(CRYPTO_TO_USD)) {
      rates[crypto] = fiatPerUsd / usdValue;
    }
    rates['USD'] = 1 / fiatPerUsd;
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        base,
        timestamp,
        rates
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function convertCurrency(url: URL) {
  const from = url.searchParams.get('from')?.toUpperCase();
  const to = url.searchParams.get('to')?.toUpperCase();
  const amountStr = url.searchParams.get('amount');

  if (!from || !to || !amountStr) {
    return new Response(
      JSON.stringify({ success: false, error: 'from, to, and amount parameters are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid amount' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate exchange rate
  let rate: number;
  let fromUsd: number;
  let toUsd: number;

  // Get from currency in USD
  if (from === 'USD') {
    fromUsd = 1;
  } else if (CRYPTO_TO_USD[from]) {
    fromUsd = CRYPTO_TO_USD[from];
  } else if (USD_TO_FIAT[from]) {
    fromUsd = 1 / USD_TO_FIAT[from];
  } else {
    return new Response(
      JSON.stringify({ success: false, error: `Unsupported currency: ${from}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get to currency from USD
  if (to === 'USD') {
    toUsd = 1;
  } else if (CRYPTO_TO_USD[to]) {
    toUsd = 1 / CRYPTO_TO_USD[to];
  } else if (USD_TO_FIAT[to]) {
    toUsd = USD_TO_FIAT[to];
  } else {
    return new Response(
      JSON.stringify({ success: false, error: `Unsupported currency: ${to}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  rate = fromUsd * toUsd;
  const convertedAmount = amount * rate;
  
  // Apply spread (0.5% for API)
  const spread = 0.005;
  const finalAmount = convertedAmount * (1 - spread);

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        from,
        to,
        amount,
        rate,
        spread_percentage: spread * 100,
        converted_amount: finalAmount,
        timestamp: new Date().toISOString(),
        valid_for_seconds: 30
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getSupportedPairs() {
  const cryptoCurrencies = Object.keys(CRYPTO_TO_USD);
  const fiatCurrencies = Object.keys(USD_TO_FIAT);

  const pairs: string[] = [];
  
  // Crypto to fiat pairs
  for (const crypto of cryptoCurrencies) {
    for (const fiat of fiatCurrencies) {
      pairs.push(`${crypto}/${fiat}`);
    }
  }

  // Crypto to crypto pairs
  for (let i = 0; i < cryptoCurrencies.length; i++) {
    for (let j = i + 1; j < cryptoCurrencies.length; j++) {
      pairs.push(`${cryptoCurrencies[i]}/${cryptoCurrencies[j]}`);
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        crypto_currencies: cryptoCurrencies,
        fiat_currencies: fiatCurrencies,
        total_pairs: pairs.length,
        pairs
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
