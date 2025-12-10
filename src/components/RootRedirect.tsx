import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "./LoadingScreen";

const RootRedirect = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Timeout protection - redirect to auth after 2 seconds max
    const timeout = setTimeout(() => {
      if (checking) {
        navigate('/auth', { replace: true });
      }
    }, 2000);

    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        navigate('/auth', { replace: true });
      } finally {
        setChecking(false);
      }
    };

    checkAuthAndRedirect();

    return () => clearTimeout(timeout);
  }, [navigate, checking]);

  if (checking) return <LoadingScreen />;
  return null;
};

export default RootRedirect;
