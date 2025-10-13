import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting rewards backfill process...');

    // Get all users
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id');

    if (profilesError) throw profilesError;

    console.log(`Found ${profiles.length} users to process`);

    let processedCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const profile of profiles) {
      try {
        const userId = profile.id;
        console.log(`Processing user ${userId}...`);

        // Get or create user rewards record
        let { data: userRewards } = await supabaseClient
          .from('user_rewards')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!userRewards) {
          const { data: newRewards, error: createError } = await supabaseClient
            .from('user_rewards')
            .insert({
              user_id: userId,
              total_points: 0,
              early_bird_points: 0,
              activity_points: 0,
              current_level: 1
            })
            .select()
            .single();

          if (createError) throw createError;
          userRewards = newRewards;
        }

        let pointsAwarded = 0;

        // Check and award account creation points (100 pts)
        const { count: accountActivityCount } = await supabaseClient
          .from('reward_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('activity_type', 'account_creation');

        if (accountActivityCount === 0) {
          const { data: pointsData } = await supabaseClient.rpc('award_points', {
            _user_id: userId,
            _activity_type: 'account_creation',
            _metadata: {}
          });
          if (pointsData) pointsAwarded += pointsData;
        }

        // Check and award KYC completion points
        const { data: kycData } = await supabaseClient
          .from('kyc_verifications')
          .select('status')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .maybeSingle();

        if (kycData) {
          const { count: kycActivityCount } = await supabaseClient
            .from('reward_activities')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('activity_type', 'kyc_completion');

          if (kycActivityCount === 0) {
            const { data: pointsData } = await supabaseClient.rpc('award_points', {
              _user_id: userId,
              _activity_type: 'kyc_completion',
              _metadata: {}
            });
            if (pointsData) pointsAwarded += pointsData;
          }
        }

        // Check and award contact sync points
        const { count: contactsCount } = await supabaseClient
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (contactsCount && contactsCount > 0) {
          const { count: contactActivityCount } = await supabaseClient
            .from('reward_activities')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('activity_type', 'contact_sync');

          if (contactActivityCount === 0) {
            const { data: pointsData } = await supabaseClient.rpc('award_points', {
              _user_id: userId,
              _activity_type: 'contact_sync',
              _metadata: {}
            });
            if (pointsData) pointsAwarded += pointsData;
          }
        }

        // Check transactions for first_transaction and transaction_volume
        const { data: transactions } = await supabaseClient
          .from('transactions')
          .select('amount, created_at')
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('created_at', { ascending: true });

        if (transactions && transactions.length > 0) {
          // Award first transaction
          const { count: firstTxActivityCount } = await supabaseClient
            .from('reward_activities')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('activity_type', 'first_transaction');

          if (firstTxActivityCount === 0) {
            const { data: pointsData } = await supabaseClient.rpc('award_points', {
              _user_id: userId,
              _activity_type: 'first_transaction',
              _metadata: {}
            });
            if (pointsData) pointsAwarded += pointsData;
          }

          // Calculate total volume and award transaction_volume points
          const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
          
          // Award 1 point per 10 USDC in volume
          const volumePoints = Math.floor(totalVolume / 10);
          
          if (volumePoints > 0) {
            const { count: volumeActivityCount } = await supabaseClient
              .from('reward_activities')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('activity_type', 'transaction_volume');

            if (volumeActivityCount === 0) {
              const { data: pointsData } = await supabaseClient.rpc('award_points', {
                _user_id: userId,
                _activity_type: 'transaction_volume',
                _metadata: { volume: totalVolume }
              });
              if (pointsData) pointsAwarded += pointsData;
            }
          }

          // Award transaction frequency (5 points per 10 transactions)
          const frequencyPoints = Math.floor(transactions.length / 10) * 5;
          if (frequencyPoints > 0) {
            const { count: freqActivityCount } = await supabaseClient
              .from('reward_activities')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('activity_type', 'transaction_frequency');

            if (freqActivityCount === 0) {
              const { data: pointsData } = await supabaseClient.rpc('award_points', {
                _user_id: userId,
                _activity_type: 'transaction_frequency',
                _metadata: { count: transactions.length }
              });
              if (pointsData) pointsAwarded += pointsData;
            }
          }
        }

        // Check and award badges
        await checkAndAwardBadges(supabaseClient, userId);

        processedCount++;
        results.push({
          userId,
          success: true,
          pointsAwarded
        });

        console.log(`Successfully processed user ${userId}, awarded ${pointsAwarded} points`);

      } catch (error: any) {
        console.error(`Error processing user ${profile.id}:`, error);
        errorCount++;
        results.push({
          userId: profile.id,
          success: false,
          error: error?.message || 'Unknown error'
        });
      }
    }

    console.log(`Backfill complete: ${processedCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill complete`,
        stats: {
          totalUsers: profiles.length,
          processed: processedCount,
          errors: errorCount
        },
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function checkAndAwardBadges(supabaseClient: any, userId: string) {
  // Get user rewards data
  const { data: rewardsData } = await supabaseClient
    .from('user_rewards')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!rewardsData) return;

  // FinMo Pioneer - Early bird points > 0
  if (rewardsData.early_bird_points > 0) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'finmo_pioneer',
      'FinMo Pioneer',
      'Joined FinMo during early access'
    );
  }

  // Volume Trader - 1000+ total transaction volume
  if (rewardsData.total_transaction_volume >= 1000) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'volume_trader',
      'Volume Trader',
      'Completed $1000+ in transactions'
    );
  }

  // Steady Earner - 500+ total points
  if (rewardsData.total_points >= 500) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'steady_earner',
      'Steady Earner',
      'Accumulated 500+ reward points'
    );
  }

  // KYC Verified
  const { data: kycData } = await supabaseClient
    .from('kyc_verifications')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();

  if (kycData) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'kyc_verified',
      'KYC Verified',
      'Completed identity verification'
    );
  }

  // Super Connector - 50+ contacts
  const { count: contactsCount } = await supabaseClient
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (contactsCount && contactsCount >= 50) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'super_connector',
      'Super Connector',
      'Synced 50+ contacts'
    );
  }
}

async function awardBadgeIfNotExists(
  supabaseClient: any,
  userId: string,
  badgeType: string,
  badgeName: string,
  badgeDescription: string
) {
  try {
    const { data, error } = await supabaseClient.rpc('award_badge', {
      _user_id: userId,
      _badge_type: badgeType,
      _badge_name: badgeName,
      _badge_description: badgeDescription
    });

    if (error && !error.message.includes('duplicate')) {
      console.error(`Error awarding badge ${badgeType} to ${userId}:`, error);
    }
  } catch (error: any) {
    if (!error.message.includes('duplicate')) {
      console.error(`Error awarding badge ${badgeType}:`, error);
    }
  }
}
