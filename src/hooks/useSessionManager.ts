import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useSessionManager = () => {
  useEffect(() => {
    const registerSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
      if (event === 'SIGNED_IN' && session) {
        await registerSession();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Update last active time
        await supabase
          .from('user_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', session.user.id);
      } else if (event === 'SIGNED_OUT') {
        toast.info("You've been signed out");
      }
    });

    // Periodic session check (every 30 seconds)
    const intervalId = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check if our session is still the active one
      const { data: activeSession } = await supabase
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (activeSession && activeSession.session_id !== session.access_token) {
        // Another device has logged in, sign out this session
        toast.error("You've been logged out because you signed in on another device");
        await supabase.auth.signOut();
      } else if (activeSession) {
        // Update last active
        await supabase
          .from('user_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', session.user.id);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);
};
