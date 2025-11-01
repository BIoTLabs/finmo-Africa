import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

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
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Decrypt private key
async function decryptPrivateKey(encryptedKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has admin role
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      console.error('Admin authorization failed for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Wallet sweep initiated by admin user: ${user.id}`);

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    const masterWalletKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    
    if (!encryptionKey || !masterWalletKey) {
      throw new Error('Missing encryption or master wallet key');
    }

    const masterWallet = new ethers.Wallet(masterWalletKey);
    const masterWalletAddress = masterWallet.address;

    console.log(`Starting wallet sweep. Master wallet: ${masterWalletAddress}`);

    // Get all users with encrypted private keys
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address, wallet_private_key_encrypted')
      .not('wallet_private_key_encrypted', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} user wallets to check`);

    const sweepResults = [];

    for (const profile of profiles || []) {
      try {
        // Decrypt user's private key
        const userPrivateKey = await decryptPrivateKey(
          profile.wallet_private_key_encrypted,
          encryptionKey
        );

        // Check balances on each chain
        for (const chain of SUPPORTED_CHAINS) {
          const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
          const userWallet = new ethers.Wallet(userPrivateKey, provider);
          const masterWalletWithProvider = new ethers.Wallet(masterWalletKey, provider);

          // Check native token balance
          const nativeBalance = await provider.getBalance(profile.wallet_address);
          const nativeBalanceEth = parseFloat(ethers.formatEther(nativeBalance));

          // Reserve some for gas (0.01 of native token)
          const gasReserve = ethers.parseEther('0.01');
          
          if (nativeBalance > gasReserve) {
            const sweepAmount = nativeBalance - gasReserve;
            const sweepAmountEth = parseFloat(ethers.formatEther(sweepAmount));

            console.log(`Sweeping ${sweepAmountEth} ${chain.nativeSymbol} from ${profile.wallet_address}`);

            try {
              const tx = await userWallet.sendTransaction({
                to: masterWalletAddress,
                value: sweepAmount,
              });

              await tx.wait();

              // Record sweep
              await supabaseClient.from('wallet_sweeps').insert({
                user_id: profile.id,
                user_wallet_address: profile.wallet_address,
                master_wallet_address: masterWalletAddress,
                token: chain.nativeSymbol,
                amount: sweepAmountEth,
                sweep_tx_hash: tx.hash,
                status: 'completed',
                completed_at: new Date().toISOString(),
              });

              // Update user balance - INCREMENT, don't set
              const { data: currentBalance } = await supabaseClient
                .from('wallet_balances')
                .select('balance')
                .eq('user_id', profile.id)
                .eq('token', chain.nativeSymbol)
                .single();

              const newBalance = (currentBalance?.balance || 0) + sweepAmountEth;

              await supabaseClient.from('wallet_balances').upsert({
                user_id: profile.id,
                token: chain.nativeSymbol,
                balance: newBalance,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,token',
              });

              // Create deposit transaction record
              const { error: txError } = await supabaseClient.from('transactions').insert({
                sender_id: profile.id,
                recipient_id: profile.id,
                sender_wallet: profile.wallet_address,
                recipient_wallet: masterWalletAddress,
                amount: sweepAmountEth,
                token: chain.nativeSymbol,
                transaction_type: 'deposit',
                transaction_hash: tx.hash,
                chain_id: chain.chainId,
                chain_name: chain.name,
                status: 'completed',
              });

              if (txError) {
                console.error('Failed to create deposit transaction:', txError);
              }

              sweepResults.push({
                user_id: profile.id,
                chain: chain.name,
                token: chain.nativeSymbol,
                amount: sweepAmountEth,
                tx_hash: tx.hash,
              });

              console.log(`Sweep completed: ${tx.hash}`);
            } catch (sweepError) {
              console.error(`Failed to sweep ${chain.nativeSymbol} from ${profile.wallet_address}:`, sweepError);
            }
          }

          // Check USDC balance
          try {
            const usdcContract = new ethers.Contract(chain.usdcContract, ERC20_ABI, provider);
            const usdcBalance = await usdcContract.balanceOf(profile.wallet_address);
            const usdcBalanceFormatted = parseFloat(ethers.formatUnits(usdcBalance, 6));

            if (usdcBalanceFormatted > 0.01) {
              console.log(`Sweeping ${usdcBalanceFormatted} USDC from ${profile.wallet_address}`);

              const usdcContractWithSigner = new ethers.Contract(chain.usdcContract, ERC20_ABI, userWallet);
              const tx = await usdcContractWithSigner.transfer(masterWalletAddress, usdcBalance);
              await tx.wait();

              // Record sweep
              await supabaseClient.from('wallet_sweeps').insert({
                user_id: profile.id,
                user_wallet_address: profile.wallet_address,
                master_wallet_address: masterWalletAddress,
                token: 'USDC',
                amount: usdcBalanceFormatted,
                sweep_tx_hash: tx.hash,
                status: 'completed',
                completed_at: new Date().toISOString(),
              });

              // Update user balance - INCREMENT, don't set
              const { data: currentUsdcBalance } = await supabaseClient
                .from('wallet_balances')
                .select('balance')
                .eq('user_id', profile.id)
                .eq('token', 'USDC')
                .single();

              const newUsdcBalance = (currentUsdcBalance?.balance || 0) + usdcBalanceFormatted;

              await supabaseClient.from('wallet_balances').upsert({
                user_id: profile.id,
                token: 'USDC',
                balance: newUsdcBalance,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,token',
              });

              // Create deposit transaction record
              const { error: usdcTxError } = await supabaseClient.from('transactions').insert({
                sender_id: profile.id,
                recipient_id: profile.id,
                sender_wallet: profile.wallet_address,
                recipient_wallet: masterWalletAddress,
                amount: usdcBalanceFormatted,
                token: 'USDC',
                transaction_type: 'deposit',
                transaction_hash: tx.hash,
                chain_id: chain.chainId,
                chain_name: chain.name,
                status: 'completed',
              });

              if (usdcTxError) {
                console.error('Failed to create USDC deposit transaction:', usdcTxError);
              }

              sweepResults.push({
                user_id: profile.id,
                chain: chain.name,
                token: 'USDC',
                amount: usdcBalanceFormatted,
                tx_hash: tx.hash,
              });

              console.log(`USDC sweep completed: ${tx.hash}`);
            }
          } catch (usdcError) {
            console.error(`Failed to sweep USDC from ${profile.wallet_address}:`, usdcError);
          }
        }
      } catch (userError) {
        console.error(`Error processing wallet ${profile.wallet_address}:`, userError);
      }
    }

    console.log(`Wallet sweep completed by admin ${user.id}. Processed ${sweepResults.length} transfers`);

    return new Response(
      JSON.stringify({
        success: true,
        sweeps_completed: sweepResults.length,
        details: sweepResults,
        initiated_by: user.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in sweep-user-wallets:', error);
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
