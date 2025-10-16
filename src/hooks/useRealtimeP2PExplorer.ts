import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ExplorerP2POrder {
  id: string;
  crypto_amount: number;
  fiat_amount: number;
  token: string;
  currency_code: string;
  rate: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  listing_id: string;
}

export const useRealtimeP2PExplorer = () => {
  const [orders, setOrders] = useState<ExplorerP2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      const { data, error } = await supabase
        .from("p2p_orders")
        .select("id, crypto_amount, fiat_amount, token, currency_code, rate, status, created_at, completed_at, listing_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading P2P orders:", error);
      } else {
        setOrders(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('explorer-p2p')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'p2p_orders',
          },
          (payload) => {
            console.log('Explorer P2P change:', payload);
            setConnected(true);
            
            if (payload.eventType === 'INSERT') {
              setOrders(prev => [payload.new as ExplorerP2POrder, ...prev.slice(0, 49)]);
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => 
                prev.map(order => order.id === payload.new.id ? payload.new as ExplorerP2POrder : order)
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

  return { orders, loading, connected };
};
