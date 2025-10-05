import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_MUMBAI_RPC = "https://rpc-mumbai.maticvigil.com";
const USDC_CONTRACT = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23";

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
    const maticResponse = await fetch(POLYGON_MUMBAI_RPC, {
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
    
    const usdcResponse = await fetch(POLYGON_MUMBAI_RPC, {
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

    // Update MATIC balance in database
    await supabaseClient
      .from('wallet_balances')
      .upsert({
        user_id: user.id,
        token: 'MATIC',
        balance: maticBalance,
      }, {
        onConflict: 'user_id,token'
      });

    // Update USDC balance in database
    await supabaseClient
      .from('wallet_balances')
      .upsert({
        user_id: user.id,
        token: 'USDC',
        balance: usdcBalance,
      }, {
        onConflict: 'user_id,token'
      });

    return new Response(
      JSON.stringify({
        success: true,
        balances: {
          MATIC: maticBalance,
          USDC: usdcBalance,
        },
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
