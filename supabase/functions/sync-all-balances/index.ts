import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
const USDC_CONTRACT = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

// Minimal ERC20 ABI for balanceOf
const ERC20_BALANCE_ABI = {
  "inputs": [{"name": "account", "type": "address"}],
  "name": "balanceOf",
  "outputs": [{"name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting balance sync for all users...');

    // Get all user profiles with wallet addresses
    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address');

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      throw profileError;
    }

    console.log(`Found ${profiles?.length || 0} users to sync`);

    let syncedCount = 0;
    let errors = 0;

    // Sync each user's balance
    for (const profile of profiles || []) {
      try {
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
        const maticBalanceWei = BigInt(maticData.result || '0x0');
        const maticBalance = Number(maticBalanceWei) / 1e18;

        // Fetch USDC balance
        const balanceOfSelector = '0x70a08231'; // balanceOf function selector
        const paddedAddress = walletAddress.slice(2).padStart(64, '0');
        const callData = balanceOfSelector + paddedAddress;

        const usdcResponse = await fetch(POLYGON_AMOY_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: USDC_CONTRACT,
                data: callData,
              },
              'latest',
            ],
            id: 2,
          }),
        });

        const usdcData = await usdcResponse.json();
        const usdcBalanceRaw = BigInt(usdcData.result || '0x0');
        const usdcBalance = Number(usdcBalanceRaw) / 1e6; // USDC has 6 decimals

        console.log(`User ${profile.id}: MATIC=${maticBalance}, USDC=${usdcBalance}`);

        // Update MATIC balance
        const { error: maticError } = await supabaseClient
          .from('wallet_balances')
          .upsert({
            user_id: profile.id,
            token: 'MATIC',
            balance: maticBalance,
          }, {
            onConflict: 'user_id,token'
          });

        if (maticError) {
          console.error(`Error updating MATIC for user ${profile.id}:`, maticError);
          errors++;
          continue;
        }

        // Update USDC balance
        const { error: usdcError } = await supabaseClient
          .from('wallet_balances')
          .upsert({
            user_id: profile.id,
            token: 'USDC',
            balance: usdcBalance,
          }, {
            onConflict: 'user_id,token'
          });

        if (usdcError) {
          console.error(`Error updating USDC for user ${profile.id}:`, usdcError);
          errors++;
          continue;
        }

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing user ${profile.id}:`, error);
        errors++;
      }
    }

    console.log(`Sync completed: ${syncedCount} users synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        errors: errors,
        total: profiles?.length || 0,
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
