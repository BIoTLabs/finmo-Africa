import { useState, useEffect } from "react";
import { blockchainService, USDC_CONTRACT } from "@/utils/blockchain";
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
      const [maticBalance, usdcBalance] = await Promise.all([
        blockchainService.getMaticBalance(walletAddress),
        blockchainService.getTokenBalance(USDC_CONTRACT, walletAddress),
      ]);

      setBalances({
        MATIC: maticBalance,
        USDC: usdcBalance,
      });
    } catch (error) {
      console.error("Error fetching blockchain balances:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncToDatabase = async (userId: string) => {
    if (!walletAddress || syncing) return;

    setSyncing(true);
    try {
      // Update MATIC balance
      await supabase
        .from("wallet_balances")
        .upsert({
          user_id: userId,
          token: "MATIC",
          balance: parseFloat(balances.MATIC),
        }, {
          onConflict: "user_id,token"
        });

      // Update USDC balance
      await supabase
        .from("wallet_balances")
        .upsert({
          user_id: userId,
          token: "USDC",
          balance: parseFloat(balances.USDC),
        }, {
          onConflict: "user_id,token"
        });

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
