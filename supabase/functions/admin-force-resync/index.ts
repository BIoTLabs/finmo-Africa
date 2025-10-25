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

    console.log('Starting admin force resync for all users...');

    // Get all user profiles with wallet addresses
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, wallet_address, phone_number')
      .not('wallet_address', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users to sync`);

    const results = {
      users_synced: 0,
      total_transactions: 0,
      total_sweeps: 0,
      errors: [] as string[],
    };

    // Step 1: Sweep all wallets to master wallet
    console.log('Step 1: Sweeping user wallets...');
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
      results.total_sweeps = sweepData.sweeps_completed || 0;
    } catch (sweepError) {
      console.error('Sweep error:', sweepError);
      results.errors.push(`Sweep error: ${sweepError instanceof Error ? sweepError.message : 'Unknown'}`);
    }

    // Step 2: Sync multichain balances for all users
    console.log('Step 2: Syncing multichain balances...');
    try {
      const balanceResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-multichain-balances`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
      });

      const balanceData = await balanceResponse.json();
      console.log('Balance sync result:', balanceData);
    } catch (balanceError) {
      console.error('Balance sync error:', balanceError);
      results.errors.push(`Balance sync error: ${balanceError instanceof Error ? balanceError.message : 'Unknown'}`);
    }

    // Step 3: Sync blockchain transactions for each user
    console.log('Step 3: Syncing blockchain transactions for all users...');
    for (const profile of profiles || []) {
      try {
        const txResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-blockchain-transactions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
            'x-user-id': profile.id,
          },
        });

        const txData = await txResponse.json();
        console.log(`Synced transactions for user ${profile.id}:`, txData);
        
        if (txData.synced_count) {
          results.total_transactions += txData.synced_count;
        }
        results.users_synced++;
      } catch (txError) {
        console.error(`Error syncing transactions for user ${profile.id}:`, txError);
        results.errors.push(`User ${profile.id}: ${txError instanceof Error ? txError.message : 'Unknown'}`);
      }
    }

    // Step 4: Refresh contact registry for all users
    console.log('Step 4: Refreshing contact FinMo user status...');
    try {
      const { data: allContacts } = await supabaseClient
        .from('contacts')
        .select('id, contact_phone, user_id');

      console.log(`Checking ${allContacts?.length || 0} contacts for FinMo status`);
      
      // This will ensure lookup_user_by_phone returns updated data
      for (const contact of allContacts || []) {
        const { data: registryData } = await supabaseClient
          .rpc('lookup_user_by_phone', { phone: contact.contact_phone });
        
        // Log if contact is a FinMo user
        if (registryData && registryData.length > 0) {
          console.log(`Contact ${contact.contact_phone} is a FinMo user`);
        }
      }
    } catch (contactError) {
      console.error('Contact refresh error:', contactError);
      results.errors.push(`Contact refresh error: ${contactError instanceof Error ? contactError.message : 'Unknown'}`);
    }

    console.log('Admin force resync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Force resync completed for all users',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in admin-force-resync:', error);
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
