import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple Account Factory ABI for counterfactual address computation
const SIMPLE_ACCOUNT_FACTORY_ABI = [
  "function getAddress(address owner, uint256 salt) view returns (address)"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    console.log(`Generating AA wallet for user: ${user.id}`);

    // Check if user already has an AA wallet
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('aa_wallet_address, aa_wallet_deployed')
      .eq('id', user.id)
      .single();

    if (profile?.aa_wallet_address) {
      console.log(`User already has AA wallet: ${profile.aa_wallet_address}`);
      return new Response(
        JSON.stringify({
          success: true,
          wallet_address: profile.aa_wallet_address,
          deployed: profile.aa_wallet_deployed,
          message: 'AA wallet already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get master wallet (the owner of all user SCWs)
    const masterWalletPrivateKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    if (!masterWalletPrivateKey) {
      throw new Error('Master wallet not configured');
    }

    const masterWallet = new ethers.Wallet(masterWalletPrivateKey);
    const factoryAddress = Deno.env.get('AA_FACTORY_ADDRESS');
    const chainRpcUrl = Deno.env.get('AA_CHAIN_RPC_URL') || 'https://rpc-amoy.polygon.technology';

    if (!factoryAddress) {
      throw new Error('AA_FACTORY_ADDRESS not configured. Please deploy the SimpleAccountFactory contract first.');
    }

    // Generate salt (unique per user)
    const salt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(user.id)));

    console.log(`Computing counterfactual address with salt: ${salt}`);

    // Compute counterfactual address (wallet doesn't need to be deployed yet)
    const provider = new ethers.JsonRpcProvider(chainRpcUrl);
    const factory = new ethers.Contract(factoryAddress, SIMPLE_ACCOUNT_FACTORY_ABI, provider);
    
    const scwAddress = await factory.getFunction('getAddress')(masterWallet.address, salt);

    console.log(`Generated AA wallet address: ${scwAddress} (counterfactual - not yet deployed)`);

    // Store in database
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        aa_wallet_address: scwAddress,
        aa_wallet_deployed: false,
        aa_wallet_salt: salt.toString(),
        wallet_address: scwAddress, // For backward compatibility
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Also update user_registry
    await supabaseClient
      .from('user_registry')
      .update({
        wallet_address: scwAddress,
      })
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        wallet_address: scwAddress,
        deployed: false,
        message: 'Smart contract wallet address generated (counterfactual). No gas required for deposits!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating AA wallet:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to generate Account Abstraction wallet'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
