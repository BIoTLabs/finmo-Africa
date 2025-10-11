import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const ERC20_BALANCE_ABI = {
  constant: true,
  inputs: [{ name: "_owner", type: "address" }],
  name: "balanceOf",
  outputs: [{ name: "balance", type: "uint256" }],
  type: "function",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile?.wallet_address) {
      throw new Error('No wallet address found');
    }

    const walletAddress = profile.wallet_address;
    console.log(`Syncing multichain balances for wallet: ${walletAddress}`);

    const balanceUpdates = [];

    for (const chain of SUPPORTED_CHAINS) {
      console.log(`Checking ${chain.name} (Chain ID: ${chain.chainId})`);

      try {
        // Fetch native token balance
        const nativeBalanceResponse = await fetch(chain.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [walletAddress, 'latest'],
            id: 1,
          }),
        });

        const nativeBalanceData = await nativeBalanceResponse.json();
        const nativeBalanceWei = BigInt(nativeBalanceData.result || '0x0');
        const nativeBalance = Number(nativeBalanceWei) / 1e18;

        console.log(`${chain.nativeSymbol} balance on ${chain.name}: ${nativeBalance}`);

        // Fetch USDC balance
        const balanceOfData = ERC20_BALANCE_ABI.inputs[0].type === 'address'
          ? walletAddress.toLowerCase().replace('0x', '').padStart(64, '0')
          : '';

        const usdcBalanceResponse = await fetch(chain.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: chain.usdcContract,
                data: `0x70a08231${balanceOfData}`,
              },
              'latest',
            ],
            id: 2,
          }),
        });

        const usdcBalanceData = await usdcBalanceResponse.json();
        const usdcBalanceRaw = BigInt(usdcBalanceData.result || '0x0');
        const usdcBalance = Number(usdcBalanceRaw) / 1e6; // USDC has 6 decimals

        console.log(`USDC balance on ${chain.name}: ${usdcBalance}`);

        // Get internal transactions for this chain
        const { data: transactions } = await supabaseClient
          .from('transactions')
          .select('*')
          .eq('chain_id', chain.chainId)
          .or(`sender_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`);

        // Calculate net internal amounts
        let internalNative = 0;
        let internalUsdc = 0;

        transactions?.forEach((tx: any) => {
          const amount = parseFloat(tx.amount);
          const isSender = tx.sender_wallet.toLowerCase() === walletAddress.toLowerCase();
          const multiplier = isSender ? -1 : 1;

          if (tx.token === chain.nativeSymbol) {
            internalNative += amount * multiplier;
            if (isSender && tx.withdrawal_fee) {
              internalNative -= parseFloat(tx.withdrawal_fee);
            }
          } else if (tx.token === 'USDC') {
            internalUsdc += amount * multiplier;
            if (isSender && tx.withdrawal_fee) {
              internalUsdc -= parseFloat(tx.withdrawal_fee);
            }
          }
        });

        // Final balances = blockchain balance + internal adjustments
        const finalNativeBalance = nativeBalance + internalNative;
        const finalUsdcBalance = usdcBalance + internalUsdc;

        balanceUpdates.push({
          token: chain.nativeSymbol,
          balance: finalNativeBalance,
          chainId: chain.chainId,
          chainName: chain.name,
        });

        balanceUpdates.push({
          token: 'USDC',
          balance: finalUsdcBalance,
          chainId: chain.chainId,
          chainName: chain.name,
        });
      } catch (chainError) {
        console.error(`Error syncing ${chain.name}:`, chainError);
      }
    }

    // Upsert all balance updates
    for (const update of balanceUpdates) {
      const { error: upsertError } = await supabaseClient
        .from('wallet_balances')
        .upsert({
          user_id: user.id,
          token: update.token,
          balance: update.balance,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (upsertError) {
        console.error(`Error upserting ${update.token} balance:`, upsertError);
      }
    }

    console.log(`Successfully synced balances across ${SUPPORTED_CHAINS.length} chains`);

    return new Response(
      JSON.stringify({
        success: true,
        wallet_address: walletAddress,
        chains_synced: SUPPORTED_CHAINS.length,
        balances: balanceUpdates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in sync-multichain-balances:', error);
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