import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
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

    console.log('Starting comprehensive rewards backfill process...');

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
        let totalPoints = 0;
        let earlyBirdPoints = 0;
        let activityPoints = 0;

        // 1. Account Creation (100 pts - early bird)
        const { data: accountCreationActivity } = await supabase
          .from('reward_activities')
          .select('id')
          .eq('user_id', profile.id)
          .eq('activity_type', 'account_creation')
          .maybeSingle();

        if (!accountCreationActivity) {
          await supabase.from('reward_activities').insert({
            user_id: profile.id,
            activity_type: 'account_creation',
            points_awarded: 100,
            metadata: {}
          });
          earlyBirdPoints += 100;
          totalPoints += 100;
          console.log(`Awarded account creation to ${profile.id}`);
        } else {
          earlyBirdPoints += 100;
          totalPoints += 100;
        }

        // 2. Contact Sync (50 pts - early bird)
        const { count: contactCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        if (contactCount && contactCount > 0) {
          const { data: contactSyncActivity } = await supabase
            .from('reward_activities')
            .select('id')
            .eq('user_id', profile.id)
            .eq('activity_type', 'contact_sync')
            .maybeSingle();

          if (!contactSyncActivity) {
            await supabase.from('reward_activities').insert({
              user_id: profile.id,
              activity_type: 'contact_sync',
              points_awarded: 50,
              metadata: { contact_count: contactCount }
            });
            earlyBirdPoints += 50;
            totalPoints += 50;
            console.log(`Awarded contact sync to ${profile.id} (${contactCount} contacts)`);
          } else {
            earlyBirdPoints += 50;
            totalPoints += 50;
          }
        }

        // 3. First Transaction (25 pts - activity)
        const { data: transactions, count: txCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact' })
          .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
          .order('created_at', { ascending: true })
          .limit(1);

        if (txCount && txCount > 0) {
          const { data: firstTxActivity } = await supabase
            .from('reward_activities')
            .select('id')
            .eq('user_id', profile.id)
            .eq('activity_type', 'first_transaction')
            .maybeSingle();

          if (!firstTxActivity) {
            await supabase.from('reward_activities').insert({
              user_id: profile.id,
              activity_type: 'first_transaction',
              points_awarded: 25,
              metadata: {}
            });
            activityPoints += 25;
            totalPoints += 25;
            console.log(`Awarded first transaction to ${profile.id}`);
          } else {
            activityPoints += 25;
            totalPoints += 25;
          }
        }

        // 4. Calculate transaction frequency points (already awarded activities)
        const { data: txFreqActivities } = await supabase
          .from('reward_activities')
          .select('points_awarded')
          .eq('user_id', profile.id)
          .eq('activity_type', 'transaction_frequency');

        if (txFreqActivities && txFreqActivities.length > 0) {
          const txFreqPoints = txFreqActivities.reduce((sum, act) => sum + act.points_awarded, 0);
          activityPoints += txFreqPoints;
          totalPoints += txFreqPoints;
        }

        // 5. Calculate transaction volume points (already awarded activities)
        const { data: txVolActivities } = await supabase
          .from('reward_activities')
          .select('points_awarded')
          .eq('user_id', profile.id)
          .eq('activity_type', 'transaction_volume');

        if (txVolActivities && txVolActivities.length > 0) {
          const txVolPoints = txVolActivities.reduce((sum, act) => sum + act.points_awarded, 0);
          activityPoints += txVolPoints;
          totalPoints += txVolPoints;
        }

        // 6. Update or insert user_rewards with calculated totals
        const { error: upsertError } = await supabase
          .from('user_rewards')
          .upsert({
            user_id: profile.id,
            early_bird_points: earlyBirdPoints,
            activity_points: activityPoints,
            total_points: totalPoints,
            current_level: Math.floor(totalPoints / 1000) + 1,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (upsertError) {
          console.error(`Error updating rewards for ${profile.id}:`, upsertError);
          results.push({
            user_id: profile.id,
            success: false,
            error: upsertError.message
          });
          continue;
        }

        console.log(`Updated rewards for ${profile.id}: ${totalPoints} total points (${earlyBirdPoints} early bird, ${activityPoints} activity)`);

        results.push({
          user_id: profile.id,
          success: true,
          total_points: totalPoints,
          early_bird_points: earlyBirdPoints,
          activity_points: activityPoints,
          contacts: contactCount || 0,
          transactions: txCount || 0
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

    const successCount = results.filter(r => r.success).length;
    console.log(`Backfill complete. Successfully processed ${successCount}/${results.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill completed: ${successCount}/${results.length} users processed successfully`,
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
