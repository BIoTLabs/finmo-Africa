import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ExplorerStakingPosition {
  id: string;
  staked_amount: number;
  token: string;
  apy_rate: number;
  duration_days: number;
  rewards_earned: number;
  status: string;
  created_at: string;
  withdrawn_at: string | null;
}

export const useRealtimeStakingExplorer = () => {
  const [positions, setPositions] = useState<ExplorerStakingPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      const { data, error } = await supabase
        .from("staking_positions")
        .select("id, staked_amount, token, apy_rate, duration_days, rewards_earned, status, created_at, withdrawn_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading staking positions:", error);
      } else {
        setPositions(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('explorer-staking')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'staking_positions',
          },
          (payload) => {
            console.log('Explorer Staking change:', payload);
            setConnected(true);
            
            if (payload.eventType === 'INSERT') {
              setPositions(prev => [payload.new as ExplorerStakingPosition, ...prev.slice(0, 49)]);
            } else if (payload.eventType === 'UPDATE') {
              setPositions(prev => 
                prev.map(pos => pos.id === payload.new.id ? payload.new as ExplorerStakingPosition : pos)
              );
            }
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
  }, []);

  return { positions, loading, connected };
};
