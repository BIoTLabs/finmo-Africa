import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

// Simple encryption using AES-256-GCM
async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Generating wallet for user: ${user.id}`);

    // Check if user already has a wallet with private key
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address, wallet_private_key_encrypted')
      .eq('id', user.id)
      .single();

    if (profile?.wallet_private_key_encrypted) {
      return new Response(
        JSON.stringify({
          success: true,
          wallet_address: profile.wallet_address,
          message: 'Wallet already exists'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    console.log(`Generated wallet address: ${walletAddress}`);

    // Encrypt private key
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const encryptedPrivateKey = await encryptPrivateKey(privateKey, encryptionKey);

    // Update profile with new wallet
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        wallet_address: walletAddress,
        wallet_private_key_encrypted: encryptedPrivateKey,
        encryption_key_version: 'v1',
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw new Error('Failed to generate wallet');
    }

    // Update user_registry
    await supabaseClient
      .from('user_registry')
      .update({ wallet_address: walletAddress })
      .eq('user_id', user.id);

    console.log(`Wallet generated successfully for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        wallet_address: walletAddress,
        message: 'Wallet generated successfully. You can now receive deposits at this address.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-user-wallet:', error);
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
