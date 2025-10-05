import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface WalletBalance {
  id: string;
  user_id: string;
  token: string;
  balance: number;
  updated_at: string;
}

export const useRealtimeBalance = (userId: string | null) => {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Load initial balances
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading balances:", error);
      } else {
        setBalances(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('balance-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallet_balances',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('Balance change received:', payload);
            
            if (payload.eventType === 'INSERT') {
              setBalances(prev => [...prev, payload.new as WalletBalance]);
            } else if (payload.eventType === 'UPDATE') {
              setBalances(prev => 
                prev.map(bal => bal.id === payload.new.id ? payload.new as WalletBalance : bal)
              );
            } else if (payload.eventType === 'DELETE') {
              setBalances(prev => prev.filter(bal => bal.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { balances, loading };
};
