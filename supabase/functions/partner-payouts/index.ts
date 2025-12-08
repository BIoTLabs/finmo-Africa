import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Private-Network': 'true',
};

// Token contract addresses on different chains
const TOKEN_CONTRACTS: Record<number, Record<string, string>> = {
  137: { // Polygon
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  },
  1: { // Ethereum
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EescdeFBC7fFc',
  },
  42161: { // Arbitrum
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  8453: { // Base
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  },
};

const RPC_URLS: Record<number, string> = {
  137: 'https://polygon-rpc.com',
  1: 'https://eth.llamarpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  8453: 'https://mainnet.base.org',
};

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

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
    const path = url.pathname.replace('/partner-payouts', '');

    // Check permissions
    if (!scopes.includes('payouts:write') && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route handling
    if (req.method === 'POST' && path === '/crypto') {
      return await createCryptoPayout(req, supabase, partnerId);
    }

    if (req.method === 'POST' && path === '/mobile-money') {
      return await createMobileMoneyPayout(req, supabase, partnerId);
    }

    if (req.method === 'POST' && path === '/bank') {
      return await createBankPayout(req, supabase, partnerId);
    }

    if (req.method === 'POST' && path === '/batch') {
      return await createBatchPayout(req, supabase, partnerId);
    }

    if (req.method === 'GET' && path.startsWith('/')) {
      const payoutId = path.slice(1);
      if (payoutId && payoutId !== 'status') {
        return await getPayoutStatus(supabase, partnerId, payoutId);
      }
      return await listPayouts(req, supabase, partnerId);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Partner payouts error:', error);
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

async function createCryptoPayout(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { 
    source_wallet_id, 
    destination_address, 
    amount, 
    token, 
    chain_id = 137,
    external_reference,
    metadata 
  } = body;

  // Validation
  if (!source_wallet_id || !destination_address || !amount || !token) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: source_wallet_id, destination_address, amount, token' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!ethers.isAddress(destination_address)) {
    return new Response(JSON.stringify({ error: 'Invalid destination address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify source wallet belongs to partner
  const { data: sourceWallet, error: walletError } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)')
    .eq('id', source_wallet_id)
    .eq('partner_id', partnerId)
    .single();

  if (walletError || !sourceWallet) {
    return new Response(JSON.stringify({ error: 'Source wallet not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check balance
  const tokenBalance = sourceWallet.partner_wallet_balances?.find(
    (b: any) => b.token === token
  )?.balance || 0;

  if (tokenBalance < amount) {
    return new Response(JSON.stringify({ 
      error: 'Insufficient balance',
      available: tokenBalance,
      requested: amount,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Calculate fee (0.1% for crypto payouts)
  const fee = amount * 0.001;
  const netAmount = amount - fee;

  // Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from('partner_transactions')
    .insert({
      partner_id: partnerId,
      source_wallet_id,
      transaction_type: 'crypto_payout',
      amount: netAmount,
      fee,
      token,
      status: 'pending',
      external_reference,
      metadata: {
        destination_address,
        chain_id,
        ...metadata,
      },
    })
    .select()
    .single();

  if (txError) {
    console.error('Transaction creation error:', txError);
    return new Response(JSON.stringify({ error: 'Failed to create payout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deduct from source wallet balance
  await supabase
    .from('partner_wallet_balances')
    .update({ balance: tokenBalance - amount })
    .eq('wallet_id', source_wallet_id)
    .eq('token', token);

  // Execute blockchain transfer (async)
  executeBlockchainTransfer(supabase, transaction.id, sourceWallet, destination_address, netAmount, token, chain_id);

  return new Response(JSON.stringify({
    success: true,
    data: {
      payout_id: transaction.id,
      status: 'pending',
      amount: netAmount,
      fee,
      token,
      destination_address,
      chain_id,
      external_reference,
      created_at: transaction.created_at,
    }
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function executeBlockchainTransfer(
  supabase: any,
  transactionId: string,
  sourceWallet: any,
  destinationAddress: string,
  amount: number,
  token: string,
  chainId: number
) {
  try {
    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Decrypt private key
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key';
    const privateKey = decryptPrivateKey(sourceWallet.wallet_private_key_encrypted, encryptionKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    let txHash: string;

    const tokenContract = TOKEN_CONTRACTS[chainId]?.[token];
    if (tokenContract) {
      // ERC20 transfer
      const contract = new ethers.Contract(tokenContract, ERC20_ABI, wallet);
      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);
      
      const tx = await contract.transfer(destinationAddress, amountInWei);
      await tx.wait();
      txHash = tx.hash;
    } else {
      // Native token transfer
      const amountInWei = ethers.parseEther(amount.toString());
      const tx = await wallet.sendTransaction({
        to: destinationAddress,
        value: amountInWei,
      });
      await tx.wait();
      txHash = tx.hash;
    }

    // Update transaction status
    await supabase
      .from('partner_transactions')
      .update({
        status: 'completed',
        blockchain_tx_hash: txHash,
        completed_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    console.log(`Payout ${transactionId} completed: ${txHash}`);

  } catch (error) {
    console.error(`Payout ${transactionId} failed:`, error);
    
    await supabase
      .from('partner_transactions')
      .update({
        status: 'failed',
        metadata: { error: (error as Error).message },
      })
      .eq('id', transactionId);
  }
}

function decryptPrivateKey(encrypted: string, encryptionKey: string): string {
  const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const decrypted = encryptedBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

async function createMobileMoneyPayout(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { 
    source_wallet_id,
    phone_number,
    amount,
    token = 'USDC',
    currency = 'KES',
    provider,
    external_reference,
    metadata 
  } = body;

  // Validation
  if (!source_wallet_id || !phone_number || !amount) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: source_wallet_id, phone_number, amount' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify source wallet
  const { data: sourceWallet, error: walletError } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)')
    .eq('id', source_wallet_id)
    .eq('partner_id', partnerId)
    .single();

  if (walletError || !sourceWallet) {
    return new Response(JSON.stringify({ error: 'Source wallet not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check balance
  const tokenBalance = sourceWallet.partner_wallet_balances?.find(
    (b: any) => b.token === token
  )?.balance || 0;

  if (tokenBalance < amount) {
    return new Response(JSON.stringify({ 
      error: 'Insufficient balance',
      available: tokenBalance,
      requested: amount,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Calculate fee (1% for mobile money payouts)
  const fee = amount * 0.01;

  // Create transaction record (pending - will be processed via P2P matching)
  const { data: transaction, error: txError } = await supabase
    .from('partner_transactions')
    .insert({
      partner_id: partnerId,
      source_wallet_id,
      transaction_type: 'mobile_money_payout',
      amount: amount - fee,
      fee,
      token,
      status: 'pending',
      external_reference,
      metadata: {
        phone_number,
        currency,
        provider: provider || 'auto',
        ...metadata,
      },
    })
    .select()
    .single();

  if (txError) {
    return new Response(JSON.stringify({ error: 'Failed to create payout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deduct from source wallet
  await supabase
    .from('partner_wallet_balances')
    .update({ balance: tokenBalance - amount })
    .eq('wallet_id', source_wallet_id)
    .eq('token', token);

  return new Response(JSON.stringify({
    success: true,
    data: {
      payout_id: transaction.id,
      status: 'pending',
      type: 'mobile_money',
      amount: amount - fee,
      fee,
      token,
      phone_number,
      currency,
      provider: provider || 'auto',
      estimated_completion: '5-30 minutes',
      external_reference,
      created_at: transaction.created_at,
    }
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createBankPayout(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { 
    source_wallet_id,
    bank_name,
    account_number,
    account_name,
    amount,
    token = 'USDC',
    currency = 'KES',
    external_reference,
    metadata 
  } = body;

  // Validation
  if (!source_wallet_id || !bank_name || !account_number || !account_name || !amount) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify source wallet
  const { data: sourceWallet, error: walletError } = await supabase
    .from('partner_wallets')
    .select('*, partner_wallet_balances(*)')
    .eq('id', source_wallet_id)
    .eq('partner_id', partnerId)
    .single();

  if (walletError || !sourceWallet) {
    return new Response(JSON.stringify({ error: 'Source wallet not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check balance
  const tokenBalance = sourceWallet.partner_wallet_balances?.find(
    (b: any) => b.token === token
  )?.balance || 0;

  if (tokenBalance < amount) {
    return new Response(JSON.stringify({ 
      error: 'Insufficient balance',
      available: tokenBalance,
      requested: amount,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Calculate fee (1.5% for bank payouts)
  const fee = amount * 0.015;

  // Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from('partner_transactions')
    .insert({
      partner_id: partnerId,
      source_wallet_id,
      transaction_type: 'bank_payout',
      amount: amount - fee,
      fee,
      token,
      status: 'pending',
      external_reference,
      metadata: {
        bank_name,
        account_number: account_number.slice(-4).padStart(account_number.length, '*'),
        account_name,
        currency,
        ...metadata,
      },
    })
    .select()
    .single();

  if (txError) {
    return new Response(JSON.stringify({ error: 'Failed to create payout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deduct from source wallet
  await supabase
    .from('partner_wallet_balances')
    .update({ balance: tokenBalance - amount })
    .eq('wallet_id', source_wallet_id)
    .eq('token', token);

  return new Response(JSON.stringify({
    success: true,
    data: {
      payout_id: transaction.id,
      status: 'pending',
      type: 'bank',
      amount: amount - fee,
      fee,
      token,
      bank_name,
      account_number: account_number.slice(-4).padStart(account_number.length, '*'),
      account_name,
      currency,
      estimated_completion: '1-3 business days',
      external_reference,
      created_at: transaction.created_at,
    }
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createBatchPayout(req: Request, supabase: any, partnerId: string) {
  const body = await req.json();
  const { payouts } = body;

  if (!Array.isArray(payouts) || payouts.length === 0) {
    return new Response(JSON.stringify({ error: 'payouts array is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (payouts.length > 100) {
    return new Response(JSON.stringify({ error: 'Maximum 100 payouts per batch' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  for (const payout of payouts) {
    try {
      let response;
      if (payout.type === 'crypto' || payout.destination_address) {
        response = await createCryptoPayout(
          new Request(req.url, {
            method: 'POST',
            headers: req.headers,
            body: JSON.stringify(payout),
          }),
          supabase,
          partnerId
        );
      } else if (payout.type === 'mobile_money' || payout.phone_number) {
        response = await createMobileMoneyPayout(
          new Request(req.url, {
            method: 'POST',
            headers: req.headers,
            body: JSON.stringify(payout),
          }),
          supabase,
          partnerId
        );
      } else if (payout.type === 'bank' || payout.bank_name) {
        response = await createBankPayout(
          new Request(req.url, {
            method: 'POST',
            headers: req.headers,
            body: JSON.stringify(payout),
          }),
          supabase,
          partnerId
        );
      } else {
        results.push({ success: false, error: 'Invalid payout type' });
        continue;
      }

      const result = await response.json();
      results.push(result);
    } catch (err) {
      results.push({ success: false, error: (err as Error).message });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return new Response(JSON.stringify({
    success: true,
    data: {
      total: payouts.length,
      successful,
      failed,
      results,
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPayoutStatus(supabase: any, partnerId: string, payoutId: string) {
  const { data: transaction, error } = await supabase
    .from('partner_transactions')
    .select('*')
    .eq('id', payoutId)
    .eq('partner_id', partnerId)
    .single();

  if (error || !transaction) {
    return new Response(JSON.stringify({ error: 'Payout not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      payout_id: transaction.id,
      status: transaction.status,
      type: transaction.transaction_type,
      amount: transaction.amount,
      fee: transaction.fee,
      token: transaction.token,
      blockchain_tx_hash: transaction.blockchain_tx_hash,
      external_reference: transaction.external_reference,
      metadata: transaction.metadata,
      created_at: transaction.created_at,
      completed_at: transaction.completed_at,
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listPayouts(req: Request, supabase: any, partnerId: string) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');

  let query = supabase
    .from('partner_transactions')
    .select('*', { count: 'exact' })
    .eq('partner_id', partnerId)
    .in('transaction_type', ['crypto_payout', 'mobile_money_payout', 'bank_payout'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (type) {
    query = query.eq('transaction_type', `${type}_payout`);
  }

  const { data: transactions, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch payouts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: transactions.map((t: any) => ({
      payout_id: t.id,
      status: t.status,
      type: t.transaction_type.replace('_payout', ''),
      amount: t.amount,
      fee: t.fee,
      token: t.token,
      blockchain_tx_hash: t.blockchain_tx_hash,
      external_reference: t.external_reference,
      created_at: t.created_at,
      completed_at: t.completed_at,
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
