import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "./LoadingScreen";
import { useSessionManager } from "@/hooks/useSessionManager";


interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const mountedRef = useRef(true);
  const loadingRef = useRef(true);
  
  // Enable single-device session management across all protected routes
  useSessionManager();

  useEffect(() => {
    mountedRef.current = true;
    loadingRef.current = true;
    
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      } else if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    // 5-second timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn("Auth check timed out, redirecting to login");
        navigate('/auth');
      }
    }, 5000);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!mountedRef.current) return;
      
      if (sessionError || !session) {
        await supabase.auth.signOut();
        navigate('/auth');
        return;
      }

      // Verify the user actually exists
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!mountedRef.current) return;
      
      if (userError || !user) {
        // User deleted but session exists - clear it
        console.error("User not found, clearing session:", userError);
        await supabase.auth.signOut();
        navigate('/auth');
        return;
      }

      setAuthenticated(true);
    } catch (error) {
      console.error("Auth check error:", error);
      if (mountedRef.current) {
        await supabase.auth.signOut();
        navigate('/auth');
      }
    } finally {
      clearTimeout(timeoutId);
      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  };

  if (loading) return <LoadingScreen />;

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
