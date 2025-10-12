import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook to automatically log out users after a period of inactivity
 * @param inactivityTimeout - Time in milliseconds before auto-logout (default: 4 minutes)
 */
export const useAutoLogout = (inactivityTimeout: number = 240000) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  };

  const handleLogout = async () => {
    console.log('Auto-logout: Logging out due to inactivity');
    await supabase.auth.signOut();
    toast.error('You have been logged out due to inactivity');
  };

  const resetTimer = () => {
    clearTimers();

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
  };

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return; // Don't set up listeners if not authenticated
      }

      // Activity events to track
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

      // Reset timer on any user activity
      const handleActivity = () => {
        resetTimer();
      };

      // Add event listeners
      events.forEach(event => {
        window.addEventListener(event, handleActivity);
      });

      // Initialize timer
      resetTimer();

      // Cleanup function
      return () => {
        clearTimers();
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
      };
    };

    checkAuth();

    // Listen for auth changes to stop tracking when logged out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearTimers();
      } else if (event === 'SIGNED_IN' && session) {
        resetTimer();
      }
    });

    return () => {
      clearTimers();
      subscription.unsubscribe();
    };
  }, [inactivityTimeout]);
};
