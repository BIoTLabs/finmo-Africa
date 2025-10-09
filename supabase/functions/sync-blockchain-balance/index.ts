import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
const USDC_CONTRACT = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Syncing blockchain balance for user:', user.id);

    // Get user's wallet address
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const walletAddress = profile.wallet_address;

    // Fetch MATIC balance
    const maticResponse = await fetch(POLYGON_AMOY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
        id: 1,
      }),
    });

    const maticData = await maticResponse.json();
    const maticWei = BigInt(maticData.result || '0');
    const maticBalance = Number(maticWei) / 1e18;

    // Fetch USDC balance using balanceOf
    const balanceOfData = `0x70a08231000000000000000000000000${walletAddress.slice(2)}`;
    
    const usdcResponse = await fetch(POLYGON_AMOY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: USDC_CONTRACT,
          data: balanceOfData,
        }, 'latest'],
        id: 1,
      }),
    });

    const usdcData = await usdcResponse.json();
    const usdcWei = BigInt(usdcData.result || '0');
    const usdcBalance = Number(usdcWei) / 1e6; // USDC has 6 decimals

    console.log('Blockchain balances:', { MATIC: maticBalance, USDC: usdcBalance });

    // Get current database balances to check for internal transfers
    const { data: currentBalances } = await supabaseClient
      .from('wallet_balances')
      .select('token, balance')
      .eq('user_id', user.id)
      .in('token', ['MATIC', 'USDC']);

    // Calculate internal transfer amounts by checking transaction history
    const { data: internalTransactions } = await supabaseClient
      .from('transactions')
      .select('token, amount, sender_id, recipient_id')
      .eq('transaction_type', 'internal')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);

    // Calculate net internal transfer amounts for each token
    const internalAmounts: Record<string, number> = {};
    internalTransactions?.forEach(tx => {
      if (!internalAmounts[tx.token]) internalAmounts[tx.token] = 0;
      if (tx.recipient_id === user.id) {
        internalAmounts[tx.token] += Number(tx.amount);
      }
      if (tx.sender_id === user.id) {
        internalAmounts[tx.token] -= Number(tx.amount);
      }
    });

    // Update MATIC balance (blockchain + internal transfers)
    const finalMaticBalance = maticBalance + (internalAmounts['MATIC'] || 0);
    await supabaseClient
      .from('wallet_balances')
      .upsert({
        user_id: user.id,
        token: 'MATIC',
        balance: finalMaticBalance,
      }, {
        onConflict: 'user_id,token'
      });

    // Update USDC balance (blockchain + internal transfers)
    const finalUsdcBalance = usdcBalance + (internalAmounts['USDC'] || 0);
    await supabaseClient
      .from('wallet_balances')
      .upsert({
        user_id: user.id,
        token: 'USDC',
        balance: finalUsdcBalance,
      }, {
        onConflict: 'user_id,token'
      });

    return new Response(
      JSON.stringify({
        success: true,
        balances: {
          MATIC: finalMaticBalance,
          USDC: finalUsdcBalance,
        },
        blockchain_balances: {
          MATIC: maticBalance,
          USDC: usdcBalance,
        },
        internal_adjustments: internalAmounts,
        wallet_address: walletAddress,
        message: 'Balances synced successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
