import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KYCTier {
  id: string;
  tier: string;
  name: string;
  description: string;
  daily_limit_usd: number;
  monthly_limit_usd: number;
  single_transaction_limit_usd: number | null;
  required_documents: string[];
  required_fields: string[];
  features: {
    can_receive?: boolean;
    can_send?: boolean;
    can_p2p?: boolean;
    can_withdraw?: boolean;
    can_stake?: boolean;
    priority_support?: boolean;
  };
  is_active: boolean;
}

export interface CountryKYCRequirement {
  id: string;
  country_iso: string;
  tier: string;
  required_documents: string[];
  required_fields: string[];
  accepted_id_types: string[];
  additional_validations: Record<string, boolean>;
  daily_limit_override: number | null;
  monthly_limit_override: number | null;
  single_transaction_limit_override: number | null;
  regulatory_notes: string | null;
  is_active: boolean;
}

export interface UserTransactionLimits {
  daily_total_usd: number;
  monthly_total_usd: number;
  daily_limit_usd: number;
  monthly_limit_usd: number;
  daily_remaining_usd: number;
  monthly_remaining_usd: number;
}

export function useKYCTiers() {
  const [tiers, setTiers] = useState<KYCTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const { data, error } = await supabase
          .from('kyc_tiers')
          .select('*')
          .eq('is_active', true)
          .order('tier');

        if (error) throw error;
        
        // Parse the tier data with proper typing
        const parsedTiers = (data || []).map(t => ({
          ...t,
          features: typeof t.features === 'string' ? JSON.parse(t.features) : t.features || {},
        })) as KYCTier[];
        
        setTiers(parsedTiers);
      } catch (err: any) {
        console.error('Error fetching KYC tiers:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTiers();
  }, []);

  return { tiers, loading, error };
}

export function useCountryKYCRequirements(countryIso: string | null) {
  const [requirements, setRequirements] = useState<CountryKYCRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequirements = async () => {
      if (!countryIso) {
        setLoading(false);
        return;
      }

      try {
        // First try country-specific requirements
        let { data, error } = await supabase
          .from('country_kyc_requirements')
          .select('*')
          .eq('country_iso', countryIso)
          .eq('is_active', true)
          .order('tier');

        if (error) throw error;

        // If no country-specific requirements, use defaults
        if (!data || data.length === 0) {
          const { data: defaultData, error: defaultError } = await supabase
            .from('country_kyc_requirements')
            .select('*')
            .eq('country_iso', 'DEFAULT')
            .eq('is_active', true)
            .order('tier');

          if (defaultError) throw defaultError;
          data = defaultData;
        }

        const parsedRequirements = (data || []).map(r => ({
          ...r,
          additional_validations: typeof r.additional_validations === 'string' 
            ? JSON.parse(r.additional_validations) 
            : r.additional_validations || {},
        })) as CountryKYCRequirement[];

        setRequirements(parsedRequirements);
      } catch (err: any) {
        console.error('Error fetching country KYC requirements:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRequirements();
  }, [countryIso]);

  return { requirements, loading, error };
}

export function useUserKYCTier() {
  const [userTier, setUserTier] = useState<string>('tier_0');
  const [limits, setLimits] = useState<UserTransactionLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get user's KYC tier from profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('kyc_tier')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        
        const tier = profile?.kyc_tier || 'tier_0';
        setUserTier(tier);

        // Get tier limits
        const { data: tierData, error: tierError } = await supabase
          .from('kyc_tiers')
          .select('daily_limit_usd, monthly_limit_usd')
          .eq('tier', tier)
          .single();

        if (tierError) throw tierError;

        // Get current transaction totals
        const today = new Date().toISOString().split('T')[0];
        const { data: limitsData } = await supabase
          .from('user_transaction_limits')
          .select('daily_total_usd, monthly_total_usd')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        const dailyTotal = limitsData?.daily_total_usd || 0;
        const monthlyTotal = limitsData?.monthly_total_usd || 0;
        const dailyLimit = tierData?.daily_limit_usd || 50;
        const monthlyLimit = tierData?.monthly_limit_usd || 200;

        setLimits({
          daily_total_usd: dailyTotal,
          monthly_total_usd: monthlyTotal,
          daily_limit_usd: dailyLimit,
          monthly_limit_usd: monthlyLimit,
          daily_remaining_usd: Math.max(0, dailyLimit - dailyTotal),
          monthly_remaining_usd: Math.max(0, monthlyLimit - monthlyTotal),
        });
      } catch (err: any) {
        console.error('Error fetching user KYC tier:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTier();
  }, []);

  return { userTier, limits, loading };
}

export function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    tier_0: 'Basic',
    tier_1: 'Verified',
    tier_2: 'Enhanced',
    tier_3: 'Premium',
  };
  return names[tier] || tier;
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    tier_0: 'bg-muted text-muted-foreground',
    tier_1: 'bg-blue-500/10 text-blue-500',
    tier_2: 'bg-purple-500/10 text-purple-500',
    tier_3: 'bg-amber-500/10 text-amber-500',
  };
  return colors[tier] || colors.tier_0;
}
