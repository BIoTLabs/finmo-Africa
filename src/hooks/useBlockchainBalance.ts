import { useState, useEffect } from "react";
import { blockchainService } from "@/utils/blockchain";
import { supabase } from "@/integrations/supabase/client";

interface BlockchainBalances {
  MATIC: string;
  USDC: string;
}

export const useBlockchainBalance = (walletAddress: string | null) => {
  const [balances, setBalances] = useState<BlockchainBalances>({
    MATIC: "0",
    USDC: "0",
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      fetchBalances();
      // Refresh every 30 seconds
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [walletAddress]);

  const fetchBalances = async () => {
    if (!walletAddress) return;

    try {
      const maticBalance = await blockchainService.getMaticBalance(walletAddress);
      
      setBalances({
        MATIC: maticBalance,
        USDC: "0", // USDC balance is now fetched per chain
      });
    } catch (error) {
      console.error("Error fetching blockchain balances:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncToDatabase = async (userId: string) => {
    if (!walletAddress || syncing) return false;

    setSyncing(true);
    try {
      // Call the edge function to sync balances from blockchain
      const { data, error } = await supabase.functions.invoke('sync-multichain-balances');
      
      if (error) throw error;
      
      // Refresh local state after sync
      await fetchBalances();
      
      return true;
    } catch (error) {
      console.error("Error syncing balances:", error);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  return { balances, loading, syncing, syncToDatabase, refetch: fetchBalances };
};
