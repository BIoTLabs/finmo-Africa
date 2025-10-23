import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TokenStats {
  token: string;
  amount: number;
}

interface WalletTransparencyData {
  hotWallet: TokenStats[];
  coldStorage: TokenStats[];
  staked: TokenStats[];
  loading: boolean;
}

export const useWalletTransparency = () => {
  const [data, setData] = useState<WalletTransparencyData>({
    hotWallet: [],
    coldStorage: [],
    staked: [],
    loading: true,
  });

  useEffect(() => {
    fetchTransparencyData();

    // Set up realtime subscriptions
    const hotWalletChannel = supabase
      .channel('wallet_balances_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_balances'
        },
        () => fetchTransparencyData()
      )
      .subscribe();

    const coldStorageChannel = supabase
      .channel('cold_wallet_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cold_wallet_transfers'
        },
        () => fetchTransparencyData()
      )
      .subscribe();

    const stakingChannel = supabase
      .channel('staking_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staking_positions'
        },
        () => fetchTransparencyData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hotWalletChannel);
      supabase.removeChannel(coldStorageChannel);
      supabase.removeChannel(stakingChannel);
    };
  }, []);

  const fetchTransparencyData = async () => {
    try {
      // Fetch total user balances (hot wallet obligations)
      const { data: balances, error: balancesError } = await supabase
        .from('wallet_balances')
        .select('token, balance');

      if (balancesError) throw balancesError;

      const hotWalletStats = balances?.reduce((acc, item) => {
        const existing = acc.find(x => x.token === item.token);
        if (existing) {
          existing.amount += Number(item.balance);
        } else {
          acc.push({ token: item.token, amount: Number(item.balance) });
        }
        return acc;
      }, [] as TokenStats[]) || [];

      // Fetch cold storage transfers
      const { data: coldTransfers, error: coldError } = await supabase
        .from('cold_wallet_transfers')
        .select('token, amount')
        .eq('status', 'completed');

      if (coldError) throw coldError;

      const coldStorageStats = coldTransfers?.reduce((acc, item) => {
        const existing = acc.find(x => x.token === item.token);
        if (existing) {
          existing.amount += Number(item.amount);
        } else {
          acc.push({ token: item.token, amount: Number(item.amount) });
        }
        return acc;
      }, [] as TokenStats[]) || [];

      // Fetch staking positions
      const { data: stakingPositions, error: stakingError } = await supabase
        .from('staking_positions')
        .select('token, staked_amount, rewards_earned')
        .eq('status', 'active');

      if (stakingError) throw stakingError;

      const stakedStats = stakingPositions?.reduce((acc, item) => {
        const existing = acc.find(x => x.token === item.token);
        const totalValue = Number(item.staked_amount) + Number(item.rewards_earned);
        if (existing) {
          existing.amount += totalValue;
        } else {
          acc.push({ token: item.token, amount: totalValue });
        }
        return acc;
      }, [] as TokenStats[]) || [];

      setData({
        hotWallet: hotWalletStats,
        coldStorage: coldStorageStats,
        staked: stakedStats,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching wallet transparency data:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  return data;
};
