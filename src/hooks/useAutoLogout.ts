import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook to automatically log out users after a period of inactivity
 * @param inactivityTimeout - Time in milliseconds before auto-logout (default: 4 minutes)
 */
export const useAutoLogout = (inactivityTimeout: number = 240000) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    console.log('Auto-logout: Logging out due to inactivity');
    clearTimers();
    await supabase.auth.signOut();
    toast.error('You have been logged out due to inactivity');
  }, [clearTimers]);

  const resetTimer = useCallback(() => {
    clearTimers();
    lastActivityRef.current = Date.now();

    // Show warning 30 seconds before logout
    const warningTime = inactivityTimeout - 30000;
    if (warningTime > 0) {
      warningRef.current = setTimeout(() => {
        toast.warning('You will be logged out in 30 seconds due to inactivity', {
          duration: 30000,
        });
      }, warningTime);
    }

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, inactivityTimeout);
  }, [inactivityTimeout, handleLogout, clearTimers]);

  useEffect(() => {
    let isAuthenticated = false;
    let cleanupFunctions: (() => void)[] = [];

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return; // Don't set up listeners if not authenticated
      }

      isAuthenticated = true;

      // Activity events to track
      const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

      // Throttle activity detection to prevent excessive timer resets
      let throttleTimeout: NodeJS.Timeout | null = null;
      const handleActivity = () => {
        const now = Date.now();
        // Only reset timer if it's been at least 1 second since last activity
        if (now - lastActivityRef.current > 1000) {
          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }
          throttleTimeout = setTimeout(() => {
            resetTimer();
          }, 100); // Debounce by 100ms
        }
      };

      // Add event listeners
      events.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
      });

      // Store cleanup function
      cleanupFunctions.push(() => {
        if (throttleTimeout) {
          clearTimeout(throttleTimeout);
        }
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
      });

      // Initialize timer
      resetTimer();
    };

    checkAuth();

    // Listen for auth changes to stop tracking when logged out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        isAuthenticated = false;
        clearTimers();
      } else if (event === 'SIGNED_IN' && session) {
        isAuthenticated = true;
        resetTimer();
      }
    });

    cleanupFunctions.push(() => {
      subscription.unsubscribe();
    });

    return () => {
      clearTimers();
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [inactivityTimeout, resetTimer, clearTimers]);
};
