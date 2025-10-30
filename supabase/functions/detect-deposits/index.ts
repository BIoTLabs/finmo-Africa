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

    // Fund wallets with gas before sweeping
    const gasFundingResults = [];
    if (depositsFound.length > 0) {
      console.log('Checking which wallets need gas funding...');
      
      const masterPrivateKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
      if (!masterPrivateKey) {
        throw new Error('MASTER_WALLET_PRIVATE_KEY not configured');
      }

      const masterWallet = new ethers.Wallet(masterPrivateKey);
      const walletsToFund = [];

      // Check each USDC deposit to see if wallet needs gas
      for (const deposit of depositsFound) {
        if (deposit.token === 'USDC' && deposit.balance >= 1.0) {
          try {
            // Check recent gas fundings for this wallet (abuse prevention)
            const { data: recentFundings } = await supabaseClient
              .from('gas_fundings')
              .select('id')
              .eq('user_wallet_address', deposit.wallet_address)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (recentFundings && recentFundings.length >= 3) {
              console.log(`Wallet ${deposit.wallet_address} already funded ${recentFundings.length} times in 24h - skipping`);
              continue;
            }

            // Find the chain config
            const chainConfig = SUPPORTED_CHAINS.find(c => c.name === deposit.chain);
            if (!chainConfig) continue;

            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
            const nativeBalance = await provider.getBalance(deposit.wallet_address);
            const nativeBalanceEth = parseFloat(ethers.formatEther(nativeBalance));

            // If wallet has less than 0.005 native token, fund it
            if (nativeBalanceEth < 0.005) {
              walletsToFund.push({
                wallet_address: deposit.wallet_address,
                user_id: deposit.user_id,
                chain: chainConfig,
                current_gas: nativeBalanceEth,
              });
            }
          } catch (error) {
            console.error(`Error checking gas for ${deposit.wallet_address}:`, error);
          }
        }
      }

      // Fund wallets that need gas
      if (walletsToFund.length > 0) {
        console.log(`Funding ${walletsToFund.length} wallets with gas...`);

        for (const walletInfo of walletsToFund) {
          try {
            const provider = new ethers.JsonRpcProvider(walletInfo.chain.rpcUrl);
            const masterWalletWithProvider = masterWallet.connect(provider);
            
            // Send 0.01 native token (enough for multiple transactions)
            const gasAmount = ethers.parseEther('0.01');
            
            const tx = await masterWalletWithProvider.sendTransaction({
              to: walletInfo.wallet_address,
              value: gasAmount,
            });

            await tx.wait();
            
            console.log(`Sent 0.01 ${walletInfo.chain.nativeSymbol} to ${walletInfo.wallet_address}: ${tx.hash}`);
            
            // Record gas funding in database
            const { error: insertError } = await supabaseClient
              .from('gas_fundings')
              .insert({
                user_id: walletInfo.user_id,
                user_wallet_address: walletInfo.wallet_address,
                master_wallet_address: masterWallet.address,
                amount: 0.01,
                token: walletInfo.chain.nativeSymbol,
                chain_name: walletInfo.chain.name,
                tx_hash: tx.hash,
                reason: 'deposit_detected',
              });

            if (insertError) {
              console.error('Failed to record gas funding:', insertError);
            }

            gasFundingResults.push({
              wallet: walletInfo.wallet_address,
              amount: 0.01,
              token: walletInfo.chain.nativeSymbol,
              tx_hash: tx.hash,
            });
          } catch (fundError) {
            console.error(`Failed to fund ${walletInfo.wallet_address}:`, fundError);
            gasFundingResults.push({
              wallet: walletInfo.wallet_address,
              error: fundError instanceof Error ? fundError.message : 'Unknown error',
            });
          }
        }

        // Wait for gas transactions to be confirmed
        console.log('Waiting 15 seconds for gas funding to be confirmed...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      // Now trigger sweep
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
            gas_fundings: gasFundingResults,
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
            gas_fundings: gasFundingResults,
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
