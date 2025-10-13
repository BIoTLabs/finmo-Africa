import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface UserRewards {
  id: string;
  user_id: string;
  total_points: number;
  early_bird_points: number;
  activity_points: number;
  current_level: number;
  consecutive_active_months: number;
  total_transaction_volume: number;
  updated_at: string;
}

export const useRealtimeRewards = (userId: string | null) => {
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Load initial rewards
      const { data, error } = await supabase
        .from("user_rewards")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error loading rewards:", error);
      } else {
        setRewards(data);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('user-rewards-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_rewards',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('Rewards update received:', payload);
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              setRewards(payload.new as UserRewards);
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

  return { rewards, loading };
};
