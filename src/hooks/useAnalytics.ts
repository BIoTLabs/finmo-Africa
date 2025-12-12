import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface RevenueData {
  date: string;
  p2p: number;
  marketplace: number;
  withdrawal: number;
  total: number;
}

export interface TokenData {
  token: string;
  volume: number;
  transactions: number;
  staked: number;
}

export interface CountryData {
  country_code: string;
  country_name: string;
  flag: string;
  users: number;
  transactions: number;
  volume: number;
}

export interface FeatureData {
  feature: string;
  usage: number;
  revenue: number;
  users: number;
}

export interface UserData {
  date: string;
  total: number;
  new: number;
  active: number;
}

export interface OverviewMetrics {
  totalUsers: number;
  totalTransactions: number;
  totalRevenue: number;
  activeCountries: number;
  totalStaked: number;
  userGrowth: number;
  revenueGrowth: number;
}

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  '+234': { name: 'Nigeria', flag: '🇳🇬' },
  '+254': { name: 'Kenya', flag: '🇰🇪' },
  '+233': { name: 'Ghana', flag: '🇬🇭' },
  '+27': { name: 'South Africa', flag: '🇿🇦' },
  '+256': { name: 'Uganda', flag: '🇺🇬' },
  '+255': { name: 'Tanzania', flag: '🇹🇿' },
  '+20': { name: 'Egypt', flag: '🇪🇬' },
  '+212': { name: 'Morocco', flag: '🇲🇦' },
  '+237': { name: 'Cameroon', flag: '🇨🇲' },
  '+225': { name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  '+221': { name: 'Senegal', flag: '🇸🇳' },
  '+250': { name: 'Rwanda', flag: '🇷🇼' },
  '+251': { name: 'Ethiopia', flag: '🇪🇹' },
  '+263': { name: 'Zimbabwe', flag: '🇿🇼' },
  '+267': { name: 'Botswana', flag: '🇧🇼' },
  '+260': { name: 'Zambia', flag: '🇿🇲' },
};

export function useOverviewMetrics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const [
          usersResult,
          transactionsResult,
          revenueResult,
          countriesResult,
          stakingResult,
          prevUsersResult,
          prevRevenueResult,
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('transactions').select('id', { count: 'exact', head: true })
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('platform_revenue').select('amount')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('supported_countries').select('id', { count: 'exact', head: true })
            .eq('is_enabled', true),
          supabase.from('staking_positions').select('staked_amount')
            .eq('status', 'active'),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .lte('created_at', dateRange.from.toISOString()),
          supabase.from('platform_revenue').select('amount')
            .gte('created_at', subDays(dateRange.from, 30).toISOString())
            .lte('created_at', dateRange.from.toISOString()),
        ]);

        const totalRevenue = revenueResult.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        const prevRevenue = prevRevenueResult.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        const totalStaked = stakingResult.data?.reduce((sum, s) => sum + (s.staked_amount || 0), 0) || 0;

        const currentUsers = usersResult.count || 0;
        const prevUsers = prevUsersResult.count || 0;
        const userGrowth = prevUsers > 0 ? ((currentUsers - prevUsers) / prevUsers) * 100 : 0;
        const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        setData({
          totalUsers: currentUsers,
          totalTransactions: transactionsResult.count || 0,
          totalRevenue,
          activeCountries: countriesResult.count || 0,
          totalStaked,
          userGrowth,
          revenueGrowth,
        });
      } catch (err: any) {
        console.error('Error fetching overview metrics:', err);
        setError(err.message || 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}

export function useRevenueAnalytics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchRevenue() {
      setLoading(true);
      setError(null);
      try {
        const { data: revenueData } = await supabase
          .from('platform_revenue')
          .select('amount, wallet_type, created_at')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true });

        const grouped: Record<string, RevenueData> = {};
        revenueData?.forEach((r) => {
          const date = format(new Date(r.created_at), 'yyyy-MM-dd');
          if (!grouped[date]) {
            grouped[date] = { date, p2p: 0, marketplace: 0, withdrawal: 0, total: 0 };
          }
          const amount = r.amount || 0;
          if (r.wallet_type === 'p2p_fees') {
            grouped[date].p2p += amount;
          } else if (r.wallet_type === 'marketplace_fees') {
            grouped[date].marketplace += amount;
          } else if (r.wallet_type === 'withdrawal_fees') {
            grouped[date].withdrawal += amount;
          }
          grouped[date].total += amount;
        });

        setData(Object.values(grouped));
      } catch (err: any) {
        console.error('Error fetching revenue:', err);
        setError(err.message || 'Failed to fetch revenue');
      } finally {
        setLoading(false);
      }
    }

    fetchRevenue();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}

export function useTokenAnalytics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchTokenData() {
      setLoading(true);
      setError(null);
      try {
        const [transactionsResult, stakingResult] = await Promise.all([
          supabase.from('transactions').select('token, amount')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('staking_positions').select('token, staked_amount')
            .eq('status', 'active'),
        ]);

        const tokenMap: Record<string, TokenData> = {};
        
        transactionsResult.data?.forEach((t) => {
          if (!tokenMap[t.token]) {
            tokenMap[t.token] = { token: t.token, volume: 0, transactions: 0, staked: 0 };
          }
          tokenMap[t.token].volume += t.amount || 0;
          tokenMap[t.token].transactions += 1;
        });

        stakingResult.data?.forEach((s) => {
          if (!tokenMap[s.token]) {
            tokenMap[s.token] = { token: s.token, volume: 0, transactions: 0, staked: 0 };
          }
          tokenMap[s.token].staked += s.staked_amount || 0;
        });

        setData(Object.values(tokenMap).sort((a, b) => b.volume - a.volume));
      } catch (err: any) {
        console.error('Error fetching token data:', err);
        setError(err.message || 'Failed to fetch token data');
      } finally {
        setLoading(false);
      }
    }

    fetchTokenData();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}

export function useCountryAnalytics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchCountryData() {
      setLoading(true);
      setError(null);
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('phone_number, id')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());

        const countryMap: Record<string, CountryData> = {};
        
        profilesData?.forEach((p) => {
          if (!p.phone_number) return;
          
          let matchedCode = '';
          for (const code of Object.keys(COUNTRY_MAP)) {
            if (p.phone_number.startsWith(code)) {
              matchedCode = code;
              break;
            }
          }
          
          if (matchedCode) {
            if (!countryMap[matchedCode]) {
              countryMap[matchedCode] = {
                country_code: matchedCode,
                country_name: COUNTRY_MAP[matchedCode].name,
                flag: COUNTRY_MAP[matchedCode].flag,
                users: 0,
                transactions: 0,
                volume: 0,
              };
            }
            countryMap[matchedCode].users += 1;
          }
        });

        setData(Object.values(countryMap).sort((a, b) => b.users - a.users));
      } catch (err: any) {
        console.error('Error fetching country data:', err);
        setError(err.message || 'Failed to fetch country data');
      } finally {
        setLoading(false);
      }
    }

    fetchCountryData();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}

export function useFeatureAnalytics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchFeatureData() {
      setLoading(true);
      setError(null);
      try {
        const [
          p2pOrders,
          marketplaceOrders,
          stakingPositions,
          transfers,
          p2pRevenue,
          marketplaceRevenue,
        ] = await Promise.all([
          supabase.from('p2p_orders').select('id, buyer_id', { count: 'exact' })
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('marketplace_orders').select('id, buyer_id', { count: 'exact' })
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('staking_positions').select('id, user_id', { count: 'exact' })
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('transactions').select('id, sender_id', { count: 'exact' })
            .eq('transaction_type', 'internal')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('platform_revenue').select('amount')
            .eq('wallet_type', 'p2p_fees')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase.from('platform_revenue').select('amount')
            .eq('wallet_type', 'marketplace_fees')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
        ]);

        const p2pUsers = new Set(p2pOrders.data?.map(o => o.buyer_id)).size;
        const marketplaceUsers = new Set(marketplaceOrders.data?.map(o => o.buyer_id)).size;
        const stakingUsers = new Set(stakingPositions.data?.map(s => s.user_id)).size;
        const transferUsers = new Set(transfers.data?.map(t => t.sender_id)).size;

        setData([
          {
            feature: 'P2P Trading',
            usage: p2pOrders.count || 0,
            revenue: p2pRevenue.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
            users: p2pUsers,
          },
          {
            feature: 'Marketplace',
            usage: marketplaceOrders.count || 0,
            revenue: marketplaceRevenue.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
            users: marketplaceUsers,
          },
          {
            feature: 'Staking',
            usage: stakingPositions.count || 0,
            revenue: 0,
            users: stakingUsers,
          },
          {
            feature: 'Transfers',
            usage: transfers.count || 0,
            revenue: 0,
            users: transferUsers,
          },
        ]);
      } catch (err: any) {
        console.error('Error fetching feature data:', err);
        setError(err.message || 'Failed to fetch feature data');
      } finally {
        setLoading(false);
      }
    }

    fetchFeatureData();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}

export function useUserAnalytics(dateRange: DateRange, enabled: boolean = true) {
  const [data, setData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function fetchUserData() {
      setLoading(true);
      setError(null);
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true });

        const grouped: Record<string, UserData> = {};
        let runningTotal = 0;

        const { count: initialCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .lt('created_at', dateRange.from.toISOString());

        runningTotal = initialCount || 0;

        profilesData?.forEach((p) => {
          const date = format(new Date(p.created_at), 'yyyy-MM-dd');
          if (!grouped[date]) {
            grouped[date] = { date, total: runningTotal, new: 0, active: 0 };
          }
          grouped[date].new += 1;
          runningTotal += 1;
          grouped[date].total = runningTotal;
        });

        setData(Object.values(grouped));
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(err.message || 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [dateRange.from, dateRange.to, enabled]);

  return { data, loading, error };
}
