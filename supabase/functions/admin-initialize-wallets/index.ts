import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log(`Wallet initialization initiated by admin user: ${user.id}`);

    // Get all users without encrypted private keys
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address, wallet_private_key_encrypted')
      .is('wallet_private_key_encrypted', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users without custodial wallets`);

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const results = {
      wallets_created: 0,
      wallets_kept: 0,
      errors: [] as string[],
    };

    for (const profile of profiles || []) {
      try {
        // Generate new wallet
        const wallet = ethers.Wallet.createRandom();
        const walletAddress = wallet.address;
        const privateKey = wallet.privateKey;

        console.log(`Generating wallet for user ${profile.id}: ${walletAddress}`);

        // Encrypt private key
        const encryptedPrivateKey = await encryptPrivateKey(privateKey, encryptionKey);

        // Update profile with new wallet
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({
            wallet_address: walletAddress,
            wallet_private_key_encrypted: encryptedPrivateKey,
            encryption_key_version: 'v1',
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error(`Failed to update profile ${profile.id}:`, updateError);
          results.errors.push(`User ${profile.id}: ${updateError.message}`);
          continue;
        }

        // Update user_registry
        await supabaseClient
          .from('user_registry')
          .update({ wallet_address: walletAddress })
          .eq('user_id', profile.id);

        results.wallets_created++;
        console.log(`✓ Wallet created for user ${profile.id}`);
      } catch (error) {
        console.error(`Error creating wallet for user ${profile.id}:`, error);
        results.errors.push(`User ${profile.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log('Wallet initialization completed:', results);

    // Now trigger sweep to move any existing deposits to master wallet
    console.log('Triggering wallet sweep...');
    try {
      const sweepResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sweep-user-wallets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
      });

      const sweepData = await sweepResponse.json();
      console.log('Sweep result:', sweepData);
    } catch (sweepError) {
      console.error('Sweep error:', sweepError);
      results.errors.push(`Sweep error: ${sweepError instanceof Error ? sweepError.message : 'Unknown'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Wallet initialization completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in admin-initialize-wallets:', error);
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
