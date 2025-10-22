import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TokenStats {
  token: string;
  amount: number;
}

interface StakingStats {
  token: string;
  total_staked: number;
  total_rewards: number;
}

interface ColdStorageStats {
  token: string;
  total_transferred: number;
  transfer_count: number;
}

interface HotWalletStats {
  token: string;
  total_user_balance: number;
  user_count: number;
}

interface WalletTransparencyData {
  hotWalletBalance: TokenStats[];
  coldStorageTransfers: TokenStats[];
  totalStaked: TokenStats[];
  loading: boolean;
}

export const useWalletTransparency = (): WalletTransparencyData => {
  const [hotWalletBalance, setHotWalletBalance] = useState<TokenStats[]>([]);
  const [coldStorageTransfers, setColdStorageTransfers] = useState<TokenStats[]>([]);
  const [totalStaked, setTotalStaked] = useState<TokenStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransparencyData = async () => {
      try {
        setLoading(true);

        // Get total user balances by token (represents hot wallet obligations)
        const { data: balances, error: balancesError } = await supabase
          .from("wallet_balances")
          .select("token, balance");

        if (balancesError) throw balancesError;

        const hotWalletAgg = (balances || []).reduce((acc, item) => {
          const existing = acc.find((x) => x.token === item.token);
          if (existing) {
            existing.amount += parseFloat(item.balance.toString());
          } else {
            acc.push({ token: item.token, amount: parseFloat(item.balance.toString()) });
          }
          return acc;
        }, [] as TokenStats[]);

        setHotWalletBalance(hotWalletAgg);

        // Get cold storage transfers
        const { data: coldTransfers, error: coldError } = await supabase
          .from("cold_wallet_transfers")
          .select("token, amount")
          .eq("status", "completed");

        if (coldError) throw coldError;

        const coldStorageAgg = (coldTransfers || []).reduce((acc, item) => {
          const existing = acc.find((x) => x.token === item.token);
          if (existing) {
            existing.amount += parseFloat(item.amount.toString());
          } else {
            acc.push({ token: item.token, amount: parseFloat(item.amount.toString()) });
          }
          return acc;
        }, [] as TokenStats[]);

        setColdStorageTransfers(coldStorageAgg);

        // Get staked amounts
        const { data: staking, error: stakingError } = await supabase
          .from("staking_positions")
          .select("token, staked_amount")
          .eq("status", "active");

        if (stakingError) throw stakingError;

        const stakingAgg = (staking || []).reduce((acc, item) => {
          const existing = acc.find((x) => x.token === item.token);
          if (existing) {
            existing.amount += parseFloat(item.staked_amount.toString());
          } else {
            acc.push({ token: item.token, amount: parseFloat(item.staked_amount.toString()) });
          }
          return acc;
        }, [] as TokenStats[]);

        setTotalStaked(stakingAgg);
      } catch (error) {
        console.error("Error fetching wallet transparency data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransparencyData();

    // Set up realtime subscriptions for live updates
    const balancesChannel = supabase
      .channel("wallet_balances_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_balances",
        },
        () => {
          fetchTransparencyData();
        }
      )
      .subscribe();

    const coldChannel = supabase
      .channel("cold_wallet_transfers_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cold_wallet_transfers",
        },
        () => {
          fetchTransparencyData();
        }
      )
      .subscribe();

    const stakingChannel = supabase
      .channel("staking_positions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staking_positions",
        },
        () => {
          fetchTransparencyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(balancesChannel);
      supabase.removeChannel(coldChannel);
      supabase.removeChannel(stakingChannel);
    };
  }, []);

  return {
    hotWalletBalance,
    coldStorageTransfers,
    totalStaked,
    loading,
  };
};
