import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface Transaction {
  id: string;
  amount: number;
  token: string;
  transaction_type: string;
  created_at: string;
  sender_wallet: string;
  recipient_wallet: string;
  sender_id: string;
  recipient_id: string | null;
  status: string;
  transaction_hash: string | null;
}

export interface WalletBalance {
  id: string;
  user_id: string;
  token: string;
  balance: number;
  updated_at: string;
  chain_id?: number;
}

interface ConsolidatedRealtimeState {
  transactions: Transaction[];
  balances: WalletBalance[];
  connected: boolean;
  loading: boolean;
}

/**
 * Consolidated realtime hook - single channel for all dashboard data
 * Reduces WebSocket connections and improves performance
 */
export const useConsolidatedRealtime = (userId: string | null) => {
  const [state, setState] = useState<ConsolidatedRealtimeState>({
    transactions: [],
    balances: [],
    connected: false,
    loading: true,
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  const aggregateBalances = useCallback((balances: WalletBalance[]): WalletBalance[] => {
    const aggregated = balances.reduce((acc, balance) => {
      const existing = acc.find(b => b.token === balance.token);
      if (existing) {
        existing.balance = Number(existing.balance) + Number(balance.balance);
      } else {
        acc.push({
          ...balance,
          balance: Number(balance.balance)
        });
      }
      return acc;
    }, [] as WalletBalance[]);
    return aggregated;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    const setupRealtimeSubscription = async () => {
      // Load initial data in parallel
      const [transactionsResult, balancesResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("wallet_balances")
          .select("*")
          .eq("user_id", userId)
      ]);

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        transactions: transactionsResult.data || [],
        balances: aggregateBalances(balancesResult.data || []),
        loading: false,
      }));

      // Single channel for all subscriptions
      channelRef.current = supabase
        .channel(`dashboard-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `sender_id=eq.${userId}`,
          },
          (payload) => {
            if (!mountedRef.current) return;
            console.log('Transaction change (sender):', payload.eventType);
            
            if (payload.eventType === 'INSERT') {
              setState(prev => ({
                ...prev,
                transactions: [payload.new as Transaction, ...prev.transactions].slice(0, 20),
                connected: true,
              }));
            } else if (payload.eventType === 'UPDATE') {
              setState(prev => ({
                ...prev,
                transactions: prev.transactions.map(tx => 
                  tx.id === payload.new.id ? payload.new as Transaction : tx
                ),
                connected: true,
              }));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            if (!mountedRef.current) return;
            console.log('Transaction received:', payload.eventType);
            setState(prev => ({
              ...prev,
              transactions: [payload.new as Transaction, ...prev.transactions].slice(0, 20),
              connected: true,
            }));
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallet_balances',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!mountedRef.current) return;
            console.log('Balance change:', payload.eventType);
            
            setState(prev => {
              let newBalances = [...prev.balances];
              
              if (payload.eventType === 'INSERT') {
                // Check if balance for this token+chain already exists
                const existingIndex = newBalances.findIndex(
                  b => b.id === (payload.new as WalletBalance).id
                );
                if (existingIndex === -1) {
                  newBalances.push(payload.new as WalletBalance);
                }
              } else if (payload.eventType === 'UPDATE') {
                newBalances = newBalances.map(bal => 
                  bal.id === payload.new.id ? payload.new as WalletBalance : bal
                );
              } else if (payload.eventType === 'DELETE') {
                newBalances = newBalances.filter(bal => bal.id !== payload.old.id);
              }
              
              return {
                ...prev,
                balances: aggregateBalances(newBalances),
                connected: true,
              };
            });
          }
        )
        .subscribe((status) => {
          if (!mountedRef.current) return;
          if (status === 'SUBSCRIBED') {
            setState(prev => ({ ...prev, connected: true }));
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setState(prev => ({ ...prev, connected: false }));
          }
        });
    };

    setupRealtimeSubscription();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, aggregateBalances]);

  return state;
};
