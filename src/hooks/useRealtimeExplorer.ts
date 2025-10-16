import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ExplorerTransaction {
  id: string;
  amount: number;
  token: string;
  transaction_type: string;
  created_at: string;
  sender_wallet: string;
  recipient_wallet: string;
  status: string;
  transaction_hash: string | null;
  chain_name: string | null;
}

interface UseRealtimeExplorerProps {
  tokenFilter?: string;
  typeFilter?: string;
  searchAddress?: string;
}

export const useRealtimeExplorer = ({ 
  tokenFilter, 
  typeFilter, 
  searchAddress 
}: UseRealtimeExplorerProps = {}) => {
  const [transactions, setTransactions] = useState<ExplorerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Build query
      let query = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Apply filters
      if (tokenFilter) {
        query = query.eq("token", tokenFilter);
      }
      if (typeFilter) {
        query = query.eq("transaction_type", typeFilter);
      }
      if (searchAddress) {
        query = query.or(`sender_wallet.ilike.%${searchAddress}%,recipient_wallet.ilike.%${searchAddress}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading explorer transactions:", error);
      } else {
        setTransactions(data || []);
      }
      setLoading(false);

      // Subscribe to real-time changes
      channel = supabase
        .channel('explorer-transactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
          },
          (payload) => {
            console.log('Explorer transaction change:', payload);
            setConnected(true);
            
            if (payload.eventType === 'INSERT') {
              const newTx = payload.new as ExplorerTransaction;
              
              // Apply filters before adding
              let shouldAdd = true;
              if (tokenFilter && newTx.token !== tokenFilter) shouldAdd = false;
              if (typeFilter && newTx.transaction_type !== typeFilter) shouldAdd = false;
              if (searchAddress && 
                  !newTx.sender_wallet.toLowerCase().includes(searchAddress.toLowerCase()) &&
                  !newTx.recipient_wallet.toLowerCase().includes(searchAddress.toLowerCase())) {
                shouldAdd = false;
              }
              
              if (shouldAdd) {
                setTransactions(prev => [newTx, ...prev.slice(0, 49)]);
              }
            } else if (payload.eventType === 'UPDATE') {
              setTransactions(prev => 
                prev.map(tx => tx.id === payload.new.id ? payload.new as ExplorerTransaction : tx)
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
  }, [tokenFilter, typeFilter, searchAddress]);

  return { transactions, loading, connected };
};
