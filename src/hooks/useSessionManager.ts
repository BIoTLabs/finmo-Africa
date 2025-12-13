import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useSessionManager = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const registerSession = async () => {
      if (!mountedRef.current) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mountedRef.current) return;

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: new Date().toISOString(),
      };

      // Register or update current session
      const { error } = await supabase
        .from('user_sessions')
        .upsert({
          user_id: session.user.id,
          session_id: session.access_token,
          device_info: deviceInfo,
          last_active: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error("Session registration error:", error);
      }
    };

    // Register session on mount
    registerSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      
      if (event === 'SIGNED_IN' && session) {
        await registerSession();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        if (!mountedRef.current) return;
        // CRITICAL: Update BOTH last_active AND session_id with new token
        await supabase
          .from('user_sessions')
          .update({ 
            last_active: new Date().toISOString(),
            session_id: session.access_token  // Keep session_id in sync with refreshed token
          })
          .eq('user_id', session.user.id);
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          toast.info("You've been signed out");
        }
      }
    });

    // Periodic session check (every 5 minutes - reduced for heavy admin pages)
    const intervalId = setInterval(async () => {
      if (!mountedRef.current) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mountedRef.current) return;

      // Check if our session is still the active one
      const { data: activeSession } = await supabase
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (activeSession && activeSession.session_id !== session.access_token) {
        // Token mismatch detected - wait and re-check to handle recent token refresh
        await new Promise(r => setTimeout(r, 2000));
        
        if (!mountedRef.current) return;
        
        // Re-fetch both fresh session and database record
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        const { data: freshActiveSession } = await supabase
          .from('user_sessions')
          .select('session_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (!mountedRef.current) return;
        
        // Only logout if STILL mismatched after retry
        if (freshActiveSession && freshSession && freshActiveSession.session_id !== freshSession.access_token) {
          toast.error("You've been logged out because you signed in on another device");
          await supabase.auth.signOut();
        }
      } else if (activeSession) {
        // Update last active
        await supabase
          .from('user_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', session.user.id);
      }
    }, 300000); // Check every 5 minutes - less aggressive for heavy admin pages

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);
};
