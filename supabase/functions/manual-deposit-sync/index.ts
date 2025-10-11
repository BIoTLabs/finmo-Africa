import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { wallet_address } = await req.json();

    if (!wallet_address) {
      throw new Error('Wallet address is required');
    }

    console.log(`Manual sync for wallet: ${wallet_address}`);

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address')
      .eq('wallet_address', wallet_address.toLowerCase())
      .single();

    if (!profile) {
      throw new Error('Wallet address not found in profiles');
    }

    // Trigger multichain sync by calling the sync function
    const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-multichain-balances`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
    });

    const syncResult = await syncResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Manual deposit sync completed',
        wallet_address,
        user_id: profile.id,
        sync_result: syncResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in manual-deposit-sync:', error);
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