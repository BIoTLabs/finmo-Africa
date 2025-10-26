import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_CHAINS = [
  {
    chainId: 80002,
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    nativeSymbol: "MATIC",
    usdcContract: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  },
  {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    nativeSymbol: "ETH",
    usdcContract: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting deposit detection...');

    // Get all user wallet addresses
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address')
      .not('wallet_address', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Checking ${profiles?.length || 0} user wallets for deposits`);

    const depositsFound = [];

    for (const profile of profiles || []) {
      for (const chain of SUPPORTED_CHAINS) {
        try {
          const provider = new ethers.JsonRpcProvider(chain.rpcUrl);

          // Check native token balance
          const nativeBalance = await provider.getBalance(profile.wallet_address);
          const nativeBalanceEth = parseFloat(ethers.formatEther(nativeBalance));

          if (nativeBalanceEth > 0.01) { // Minimum 0.01 to avoid dust
            depositsFound.push({
              user_id: profile.id,
              wallet_address: profile.wallet_address,
              chain: chain.name,
              token: chain.nativeSymbol,
              balance: nativeBalanceEth,
            });

            console.log(`Found ${nativeBalanceEth} ${chain.nativeSymbol} in ${profile.wallet_address}`);
          }

          // Check USDC balance
          const usdcContract = new ethers.Contract(chain.usdcContract, ERC20_ABI, provider);
          const usdcBalance = await usdcContract.balanceOf(profile.wallet_address);
          const usdcBalanceFormatted = parseFloat(ethers.formatUnits(usdcBalance, 6));

          if (usdcBalanceFormatted > 0.01) { // Minimum 0.01 USDC
            depositsFound.push({
              user_id: profile.id,
              wallet_address: profile.wallet_address,
              chain: chain.name,
              token: 'USDC',
              balance: usdcBalanceFormatted,
            });

            console.log(`Found ${usdcBalanceFormatted} USDC in ${profile.wallet_address}`);
          }
        } catch (chainError) {
          console.error(`Error checking ${chain.name} for ${profile.wallet_address}:`, chainError);
        }
      }
    }

    console.log(`Deposit detection completed. Found ${depositsFound.length} deposits`);

    // If deposits found, trigger sweep
    if (depositsFound.length > 0) {
      console.log('Triggering sweep function...');
      try {
        const sweepResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/sweep-user-wallets`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const sweepData = await sweepResponse.json();
        console.log('Sweep triggered:', sweepData);

        return new Response(
          JSON.stringify({
            success: true,
            deposits_found: depositsFound.length,
            deposits: depositsFound,
            sweep_result: sweepData,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (sweepError) {
        console.error('Failed to trigger sweep:', sweepError);
        return new Response(
          JSON.stringify({
            success: true,
            deposits_found: depositsFound.length,
            deposits: depositsFound,
            sweep_error: sweepError instanceof Error ? sweepError.message : 'Unknown',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deposits_found: 0,
        message: 'No deposits detected',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in detect-deposits:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
