import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TransactionLimits {
  currentTier: string;
  dailyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  loading: boolean;
}

export function useTransactionLimits(userId: string | null): TransactionLimits {
  const [limits, setLimits] = useState<TransactionLimits>({
    currentTier: 'tier_0',
    dailyLimit: 0,
    monthlyLimit: 0,
    singleTransactionLimit: 0,
    dailyUsed: 0,
    monthlyUsed: 0,
    dailyRemaining: 0,
    monthlyRemaining: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setLimits(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchLimits = async () => {
      try {
        // Get user's KYC tier from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('kyc_tier')
          .eq('id', userId)
          .single();

        const userTier = profile?.kyc_tier || 'tier_0';

        // Get tier limits
        const { data: tierData } = await supabase
          .from('kyc_tiers')
          .select('daily_limit_usd, monthly_limit_usd, single_transaction_limit_usd')
          .eq('tier', userTier)
          .eq('is_active', true)
          .single();

        if (!tierData) {
          setLimits(prev => ({ ...prev, loading: false }));
          return;
        }

        const dailyLimit = tierData.daily_limit_usd;
        const monthlyLimit = tierData.monthly_limit_usd;
        const singleTransactionLimit = tierData.single_transaction_limit_usd || dailyLimit;

        // Get today's usage
        const today = new Date().toISOString().split('T')[0];
        const { data: dailyRecord } = await supabase
          .from('user_transaction_limits')
          .select('daily_total_usd')
          .eq('user_id', userId)
          .eq('date', today)
          .single();

        const dailyUsed = Number(dailyRecord?.daily_total_usd || 0);

        // Get monthly usage
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        const monthStart = firstDayOfMonth.toISOString().split('T')[0];

        const { data: monthlyRecords } = await supabase
          .from('user_transaction_limits')
          .select('daily_total_usd')
          .eq('user_id', userId)
          .gte('date', monthStart);

        const monthlyUsed = monthlyRecords?.reduce((sum, r) => sum + Number(r.daily_total_usd || 0), 0) || 0;

        setLimits({
          currentTier: userTier,
          dailyLimit,
          monthlyLimit,
          singleTransactionLimit,
          dailyUsed,
          monthlyUsed,
          dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
          monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
          loading: false,
        });
      } catch (error) {
        console.error('Failed to fetch transaction limits:', error);
        setLimits(prev => ({ ...prev, loading: false }));
      }
    };

    fetchLimits();
  }, [userId]);

  return limits;
}

export function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    tier_0: 'Unverified',
    tier_1: 'Basic',
    tier_2: 'Standard',
    tier_3: 'Premium',
  };
  return names[tier] || tier;
}

export function getTierBadgeColor(tier: string): string {
  const colors: Record<string, string> = {
    tier_0: 'bg-muted text-muted-foreground',
    tier_1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    tier_2: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    tier_3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return colors[tier] || colors.tier_0;
}
