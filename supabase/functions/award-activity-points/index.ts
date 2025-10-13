import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AwardPointsRequest {
  activity_type: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { activity_type, metadata = {} }: AwardPointsRequest = await req.json();

    console.log(`Awarding points for ${activity_type} to user ${user.id}`);

    // Award points using the database function
    const { data: pointsAwarded, error: awardError } = await supabaseClient.rpc('award_points', {
      _user_id: user.id,
      _activity_type: activity_type,
      _metadata: metadata,
    });

    if (awardError) {
      console.error('Error awarding points:', awardError);
      throw awardError;
    }

    console.log(`Awarded ${pointsAwarded} points for ${activity_type}`);

    // Check for badge eligibility
    await checkAndAwardBadges(supabaseClient, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        points_awarded: pointsAwarded,
        message: `Earned ${pointsAwarded} points!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in award-activity-points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function checkAndAwardBadges(supabaseClient: any, userId: string) {
  // Get user rewards
  const { data: rewards } = await supabaseClient
    .from('user_rewards')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!rewards) return;

  // Check for FinMo Pioneer badge (early adopter - 100+ early bird points)
  if (rewards.early_bird_points >= 100) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'finmo_pioneer',
      'FinMo Pioneer',
      'Early adopter of FinMo platform'
    );
  }

  // Check for Volume Trader badge (1000+ total transaction volume)
  if (rewards.total_transaction_volume >= 1000) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'volume_trader',
      'Volume Trader',
      'Traded over $1,000 in volume'
    );
  }

  // Check for Steady Earner badge (3+ consecutive active months)
  if (rewards.consecutive_active_months >= 3) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'steady_earner',
      'Steady Earner',
      'Active for 3 consecutive months'
    );
  }

  // Check for KYC Verified badge
  const { data: kycData } = await supabaseClient
    .from('kyc_verifications')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .single();

  if (kycData) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'kyc_verified',
      'KYC Verified',
      'Completed identity verification'
    );
  }

  // Check for Super Connector badge (invited 10+ users)
  const { count } = await supabaseClient
    .from('contact_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', userId);

  if (count && count >= 10) {
    await awardBadgeIfNotExists(
      supabaseClient,
      userId,
      'super_connector',
      'Super Connector',
      'Invited 10+ users to FinMo'
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
  const { error } = await supabaseClient.rpc('award_badge', {
    _user_id: userId,
    _badge_type: badgeType,
    _badge_name: badgeName,
    _badge_description: badgeDescription,
  });

  if (error && !error.message.includes('duplicate')) {
    console.error(`Error awarding badge ${badgeType}:`, error);
  } else if (!error) {
    console.log(`Awarded badge ${badgeType} to user ${userId}`);
  }
}
