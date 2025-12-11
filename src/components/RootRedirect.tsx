import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "./LoadingScreen";

const RootRedirect = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkingRef.current = true;

    // Timeout protection - redirect to auth after 2 seconds max
    const timeout = setTimeout(() => {
      if (checkingRef.current && mountedRef.current) {
        navigate('/auth', { replace: true });
      }
    }, 2000);

    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;
        
        if (session) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mountedRef.current) {
          navigate('/auth', { replace: true });
        }
      } finally {
        if (mountedRef.current) {
          checkingRef.current = false;
          setChecking(false);
        }
      }
    };

    checkAuthAndRedirect();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
    };
  }, [navigate]); // Only navigate as dependency - removed checking

  if (checking) return <LoadingScreen />;
  return null;
};

export default RootRedirect;
