import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ExplorerMarketplaceOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  listing_id: string;
  escrow_released: boolean;
}

export const useRealtimeMarketplaceExplorer = () => {
  const [orders, setOrders] = useState<ExplorerMarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("id, amount, currency, status, created_at, delivered_at, listing_id, escrow_released")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading marketplace orders:", error);
      } else {
        setOrders(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('explorer-marketplace')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'marketplace_orders',
          },
          (payload) => {
            console.log('Explorer Marketplace change:', payload);
            setConnected(true);
            
            if (payload.eventType === 'INSERT') {
              setOrders(prev => [payload.new as ExplorerMarketplaceOrder, ...prev.slice(0, 49)]);
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => 
                prev.map(order => order.id === payload.new.id ? payload.new as ExplorerMarketplaceOrder : order)
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
