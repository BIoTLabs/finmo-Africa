import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBlockchainBalance } from './useBlockchainBalance';

/**
 * Hook to automatically sync blockchain balances on mount and periodically
 */
export const useAutoBalanceSync = (userId: string | null, walletAddress: string | null) => {
  const { syncToDatabase } = useBlockchainBalance(walletAddress);

  useEffect(() => {
    if (!userId || !walletAddress) return;

    // Sync on mount
    const initialSync = async () => {
      try {
        await supabase.functions.invoke('sync-blockchain-balance');
      } catch (error) {
        console.error('Initial balance sync failed:', error);
      }
    };

    initialSync();

    // Sync every 2 minutes
    const interval = setInterval(async () => {
      try {
        await supabase.functions.invoke('sync-blockchain-balance');
      } catch (error) {
        console.error('Periodic balance sync failed:', error);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [userId, walletAddress]);
};
