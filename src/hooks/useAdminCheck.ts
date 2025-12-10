import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAdminCheck = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Timeout protection - max 5 seconds for admin check
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Admin check timed out');
        setIsAdmin(false);
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Use getSession first (faster, cached) then verify with has_role
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .rpc('has_role', { _user_id: session.user.id, _role: 'admin' });

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setIsAdmin(data || false);
        setLoading(false);
      } catch (error) {
        console.error('Error in admin check:', error);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  return { isAdmin, loading };
};