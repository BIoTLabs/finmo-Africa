import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    console.log('Starting rewards backfill process...');

    // Get all users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, created_at');

    if (profilesError) {
      throw profilesError;
    }

    const results = [];

    for (const profile of profiles || []) {
      try {
        // Check if user already has rewards
        const { data: existingRewards } = await supabase
          .from('user_rewards')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (!existingRewards) {
          // Initialize rewards with account creation points
          const { error: insertError } = await supabase
            .from('user_rewards')
            .insert({
              user_id: profile.id,
              early_bird_points: 100,
              total_points: 100
            });

          if (insertError) {
            console.error(`Error creating rewards for ${profile.id}:`, insertError);
            results.push({
              user_id: profile.id,
              success: false,
              error: insertError.message
            });
            continue;
          }

          // Log account creation reward activity
          await supabase
            .from('reward_activities')
            .insert({
              user_id: profile.id,
              activity_type: 'account_creation',
              points_awarded: 100
            });

          console.log(`Initialized rewards for user ${profile.id}`);
        }

        // Check if user has synced contacts
        const { count: contactCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        if (contactCount && contactCount > 0) {
          // Check if contact sync reward already given
          const { data: existingContactReward } = await supabase
            .from('reward_activities')
            .select('id')
            .eq('user_id', profile.id)
            .eq('activity_type', 'contact_sync')
            .maybeSingle();

          if (!existingContactReward) {
            // Award contact sync points using the award_points function
            const { error: awardError } = await supabase.rpc('award_points', {
              _user_id: profile.id,
              _activity_type: 'contact_sync',
              _metadata: { contact_count: contactCount }
            });

            if (awardError) {
              console.error(`Error awarding contact sync for ${profile.id}:`, awardError);
            } else {
              console.log(`Awarded contact sync points to user ${profile.id}`);
            }
          }
        }

        results.push({
          user_id: profile.id,
          success: true,
          contact_count: contactCount || 0
        });

      } catch (error) {
        console.error(`Error processing user ${profile.id}:`, error);
        results.push({
          user_id: profile.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`Backfill complete. Processed ${results.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill completed for ${results.length} users`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
