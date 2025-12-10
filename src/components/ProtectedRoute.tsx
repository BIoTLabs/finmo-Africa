import { useEffect, useState } from "react";
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
  
  // Enable single-device session management across all protected routes
  useSessionManager();

  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      } else if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        await supabase.auth.signOut();
        navigate('/auth');
        return;
      }

      // Verify the user actually exists
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
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
      await supabase.auth.signOut();
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
