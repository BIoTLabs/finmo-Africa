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

    // Sync on mount - both balances and transactions
    const initialSync = async () => {
      try {
        await Promise.all([
          supabase.functions.invoke('sync-blockchain-balance'),
          supabase.functions.invoke('sync-blockchain-transactions')
        ]);
        console.log('Initial blockchain sync completed');
      } catch (error) {
        console.error('Initial blockchain sync failed:', error);
      }
    };

    initialSync();

    // Sync every 2 minutes
    const interval = setInterval(async () => {
      try {
        await Promise.all([
          supabase.functions.invoke('sync-blockchain-balance'),
          supabase.functions.invoke('sync-blockchain-transactions')
        ]);
        console.log('Periodic blockchain sync completed');
      } catch (error) {
        console.error('Periodic blockchain sync failed:', error);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [userId, walletAddress]);
};
