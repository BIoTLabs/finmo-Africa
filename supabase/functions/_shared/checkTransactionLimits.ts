// Shared utility for checking KYC tier transaction limits
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface LimitCheckResult {
  allowed: boolean;
  error?: string;
  currentTier: string;
  dailyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
}

export async function checkTransactionLimits(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number
): Promise<LimitCheckResult> {
  // Get user's KYC tier from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('kyc_tier')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Failed to fetch profile:', profileError);
    throw new Error('Unable to verify transaction limits');
  }

  const userTier = profile?.kyc_tier || 'tier_0';

  // Get tier limits
  const { data: tierLimits, error: tierError } = await supabase
    .from('kyc_tiers')
    .select('daily_limit_usd, monthly_limit_usd, single_transaction_limit_usd')
    .eq('tier', userTier)
    .eq('is_active', true)
    .single();

  if (tierError || !tierLimits) {
    console.error('Failed to fetch tier limits:', tierError);
    // Default to most restrictive limits
    return {
      allowed: false,
      error: 'Unable to verify transaction limits. Please complete KYC verification.',
      currentTier: userTier,
      dailyLimit: 0,
      monthlyLimit: 0,
      singleTransactionLimit: 0,
      dailyUsed: 0,
      monthlyUsed: 0,
      dailyRemaining: 0,
      monthlyRemaining: 0,
    };
  }

  const dailyLimit = tierLimits.daily_limit_usd;
  const monthlyLimit = tierLimits.monthly_limit_usd;
  const singleTransactionLimit = tierLimits.single_transaction_limit_usd || dailyLimit;

  // Check single transaction limit
  if (amountUsd > singleTransactionLimit) {
    return {
      allowed: false,
      error: `Transaction amount ($${amountUsd.toFixed(2)}) exceeds your single transaction limit of $${singleTransactionLimit.toFixed(2)}. Upgrade your KYC tier for higher limits.`,
      currentTier: userTier,
      dailyLimit,
      monthlyLimit,
      singleTransactionLimit,
      dailyUsed: 0,
      monthlyUsed: 0,
      dailyRemaining: dailyLimit,
      monthlyRemaining: monthlyLimit,
    };
  }

  // Get or create daily tracking record
  const today = new Date().toISOString().split('T')[0];
  
  // Try to get existing record
  let { data: limitRecord, error: limitError } = await supabase
    .from('user_transaction_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (limitError && limitError.code !== 'PGRST116') {
    console.error('Failed to fetch limit record:', limitError);
  }

  // Create record if doesn't exist
  if (!limitRecord) {
    const { data: newRecord, error: insertError } = await supabase
      .from('user_transaction_limits')
      .insert({
        user_id: userId,
        date: today,
        daily_total_usd: 0,
        monthly_total_usd: 0,
        transaction_count: 0,
      })
      .select()
      .single();

    if (insertError && insertError.code !== '23505') { // Ignore duplicate key error
      console.error('Failed to create limit record:', insertError);
    }
    
    limitRecord = newRecord || { daily_total_usd: 0, monthly_total_usd: 0, transaction_count: 0 };
  }

  // Calculate monthly usage (sum of all days in current month)
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const monthStart = firstDayOfMonth.toISOString().split('T')[0];

  const { data: monthlyRecords } = await supabase
    .from('user_transaction_limits')
    .select('daily_total_usd')
    .eq('user_id', userId)
    .gte('date', monthStart);

  const monthlyUsed = monthlyRecords?.reduce((sum, r) => sum + Number(r.daily_total_usd || 0), 0) || 0;
  const dailyUsed = Number(limitRecord?.daily_total_usd || 0);

  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);

  // Check daily limit
  if (dailyUsed + amountUsd > dailyLimit) {
    return {
      allowed: false,
      error: `This transaction would exceed your daily limit. You've used $${dailyUsed.toFixed(2)} of your $${dailyLimit.toFixed(2)} daily limit. Remaining: $${dailyRemaining.toFixed(2)}`,
      currentTier: userTier,
      dailyLimit,
      monthlyLimit,
      singleTransactionLimit,
      dailyUsed,
      monthlyUsed,
      dailyRemaining,
      monthlyRemaining,
    };
  }

  // Check monthly limit
  if (monthlyUsed + amountUsd > monthlyLimit) {
    return {
      allowed: false,
      error: `This transaction would exceed your monthly limit. You've used $${monthlyUsed.toFixed(2)} of your $${monthlyLimit.toFixed(2)} monthly limit. Remaining: $${monthlyRemaining.toFixed(2)}`,
      currentTier: userTier,
      dailyLimit,
      monthlyLimit,
      singleTransactionLimit,
      dailyUsed,
      monthlyUsed,
      dailyRemaining,
      monthlyRemaining,
    };
  }

  return {
    allowed: true,
    currentTier: userTier,
    dailyLimit,
    monthlyLimit,
    singleTransactionLimit,
    dailyUsed,
    monthlyUsed,
    dailyRemaining: dailyRemaining - amountUsd,
    monthlyRemaining: monthlyRemaining - amountUsd,
  };
}

export async function updateTransactionLimits(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Try to get existing record
  const { data: existing } = await supabase
    .from('user_transaction_limits')
    .select('id, daily_total_usd, transaction_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    // Update existing record
    await supabase
      .from('user_transaction_limits')
      .update({
        daily_total_usd: Number(existing.daily_total_usd || 0) + amountUsd,
        transaction_count: (existing.transaction_count || 0) + 1,
        last_transaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Insert new record
    await supabase
      .from('user_transaction_limits')
      .insert({
        user_id: userId,
        date: today,
        daily_total_usd: amountUsd,
        transaction_count: 1,
        last_transaction_at: new Date().toISOString(),
      });
  }
}
