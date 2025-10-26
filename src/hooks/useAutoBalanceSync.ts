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

    // Sync on mount - detect deposits and sweep
    const initialSync = async () => {
      try {
        console.log('Initial deposit detection and sweep...');
        // Detect deposits which will trigger sweep automatically
        await supabase.functions.invoke('detect-deposits');
        // Then sync balances from database
        await supabase.functions.invoke('sync-multichain-balances');
        console.log('Initial blockchain sync completed');
      } catch (error) {
        console.error('Initial blockchain sync failed:', error);
      }
    };

    initialSync();

    // Sync every 2 minutes - detect deposits and sweep
    const interval = setInterval(async () => {
      try {
        console.log('Periodic deposit detection and sweep...');
        // Detect deposits which will trigger sweep automatically
        await supabase.functions.invoke('detect-deposits');
        // Then sync balances from database
        await supabase.functions.invoke('sync-multichain-balances');
        console.log('Periodic blockchain sync completed');
      } catch (error) {
        console.error('Periodic blockchain sync failed:', error);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [userId, walletAddress]);
};
