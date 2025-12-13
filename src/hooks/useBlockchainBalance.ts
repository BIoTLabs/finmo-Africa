import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlockchainBalances {
  MATIC: string;
  USDC: string;
}

/**
 * Hook for blockchain balance operations
 * Removed aggressive polling - now only syncs on-demand
 */
export const useBlockchainBalance = (walletAddress: string | null) => {
  const [balances, setBalances] = useState<BlockchainBalances>({
    MATIC: "0",
    USDC: "0",
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const syncToDatabase = useCallback(async (userId: string) => {
    if (!walletAddress || syncing) return false;

    setSyncing(true);
    try {
      // Call the edge function to sync balances from blockchain
      const { error } = await supabase.functions.invoke('sync-multichain-balances');
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error("Error syncing balances:", error);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [walletAddress, syncing]);

  const refetch = useCallback(async () => {
    // No-op - balances come from database via useRealtimeBalance
    // This is kept for API compatibility
  }, []);

  return { balances, loading, syncing, syncToDatabase, refetch };
};
