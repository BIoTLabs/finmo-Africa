import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to sync blockchain balances on-demand and less frequently
 * Removed aggressive polling to improve performance
 */
export const useAutoBalanceSync = (userId: string | null, walletAddress: string | null) => {
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  const syncBalances = useCallback(async () => {
    if (!userId || !walletAddress || isSyncingRef.current) return;
    
    // Prevent syncing more than once every 5 minutes
    const now = Date.now();
    if (now - lastSyncRef.current < 300000) {
      console.log('Skipping sync - too soon since last sync');
      return;
    }

    isSyncingRef.current = true;
    lastSyncRef.current = now;

    try {
      console.log('Syncing multichain balances...');
      await supabase.functions.invoke('sync-multichain-balances');
      console.log('Balance sync completed');
    } catch (error) {
      console.error('Balance sync failed:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [userId, walletAddress]);

  useEffect(() => {
    if (!userId || !walletAddress) return;

    // Initial sync on mount (only once)
    syncBalances();

    // Sync every 5 minutes instead of 2 minutes
    const interval = setInterval(syncBalances, 300000);

    return () => clearInterval(interval);
  }, [userId, walletAddress, syncBalances]);

  return { syncBalances };
};
