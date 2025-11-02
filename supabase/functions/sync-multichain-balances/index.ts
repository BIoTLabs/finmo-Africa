import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

const SUPPORTED_CHAINS = [
  {
    chainId: 80002,
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    nativeSymbol: "MATIC",
  },
  {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    nativeSymbol: "ETH",
  },
  {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    nativeSymbol: "ETH",
  },
  {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    nativeSymbol: "ETH",
  },
  {
    chainId: 11155420,
    name: "Optimism Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    nativeSymbol: "ETH",
  },
  {
    chainId: 534351,
    name: "Scroll Sepolia",
    rpcUrl: "https://sepolia-rpc.scroll.io",
    nativeSymbol: "ETH",
  },
  {
    chainId: 80001,
    name: "Polygon Mumbai",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    nativeSymbol: "MATIC",
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

    // Fetch all active tokens from database
    const { data: allTokens, error: tokensError } = await supabaseClient
      .from('chain_tokens')
      .select('*')
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching chain tokens:', tokensError);
      throw tokensError;
    }

    console.log(`Syncing ${allTokens?.length || 0} active tokens across ${SUPPORTED_CHAINS.length} chains`);

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

        // Fetch all ERC20 token balances for this chain
        const chainTokens = allTokens?.filter(t => t.chain_id === chain.chainId) || [];
        const tokenBalances: Record<string, number> = {};

        for (const tokenConfig of chainTokens) {
          try {
            const balanceOfData = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
            
            const tokenBalanceResponse = await fetch(chain.rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [
                  {
                    to: tokenConfig.contract_address,
                    data: `0x70a08231${balanceOfData}`,
                  },
                  'latest',
                ],
                id: 2,
              }),
            });

            const tokenBalanceData = await tokenBalanceResponse.json();
            const tokenBalanceRaw = BigInt(tokenBalanceData.result || '0x0');
            const tokenBalance = Number(tokenBalanceRaw) / Math.pow(10, tokenConfig.decimals);

            tokenBalances[tokenConfig.token_symbol] = tokenBalance;
            console.log(`${tokenConfig.token_symbol} balance on ${chain.name}: ${tokenBalance}`);
          } catch (tokenError) {
            console.error(`Error fetching ${tokenConfig.token_symbol} balance:`, tokenError);
            tokenBalances[tokenConfig.token_symbol] = 0;
          }
        }

        // Get internal transactions for this chain
        const { data: transactions } = await supabaseClient
          .from('transactions')
          .select('*')
          .eq('chain_id', chain.chainId)
          .or(`sender_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`);

        // Calculate database balance from all completed transactions
        const dbBalances: Record<string, number> = { [chain.nativeSymbol]: 0 };
        
        // Initialize all token balances to 0
        for (const tokenConfig of chainTokens) {
          dbBalances[tokenConfig.token_symbol] = 0;
        }

        transactions?.forEach((tx: any) => {
          if (tx.status !== 'completed') return;
          
          const amount = parseFloat(tx.amount);
          const isRecipient = tx.recipient_id === user.id;
          const isSender = tx.sender_id === user.id;

          if (!dbBalances.hasOwnProperty(tx.token)) {
            dbBalances[tx.token] = 0;
          }

          if (isRecipient) {
            dbBalances[tx.token] += amount;
          } else if (isSender) {
            dbBalances[tx.token] -= amount;
            if (tx.withdrawal_fee) {
              dbBalances[tx.token] -= parseFloat(tx.withdrawal_fee);
            }
          }
        });

        // Final balances are ONLY from database transactions
        // Blockchain balances are for reference/verification only
        console.log(`${chain.name} - DB balances:`, dbBalances);
        console.log(`${chain.name} - Blockchain balances: ${chain.nativeSymbol}=${nativeBalance}, Tokens:`, tokenBalances);

        // Add native token balance
        balanceUpdates.push({
          token: chain.nativeSymbol,
          balance: Math.max(0, dbBalances[chain.nativeSymbol] || 0),
          chainId: chain.chainId,
          chainName: chain.name,
        });

        // Add all ERC20 token balances
        for (const tokenSymbol in tokenBalances) {
          balanceUpdates.push({
            token: tokenSymbol,
            balance: Math.max(0, dbBalances[tokenSymbol] || 0),
            chainId: chain.chainId,
            chainName: chain.name,
          });
        }
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
          chain_id: update.chainId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token,chain_id',
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