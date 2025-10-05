import { useEffect, useState } from "react";
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

export const useRealtimeTransactions = (userId: string | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Load initial transactions
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error loading transactions:", error);
      } else {
        setTransactions(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('transactions-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `sender_id=eq.${userId}`,
          },
          (payload) => {
            console.log('Transaction change received:', payload);
            setConnected(true);
            
            if (payload.eventType === 'INSERT') {
              setTransactions(prev => [payload.new as Transaction, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setTransactions(prev => 
                prev.map(tx => tx.id === payload.new.id ? payload.new as Transaction : tx)
              );
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
            console.log('Received transaction:', payload);
            setConnected(true);
            setTransactions(prev => [payload.new as Transaction, ...prev]);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnected(false);
          }
        });
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { transactions, loading, connected };
};
