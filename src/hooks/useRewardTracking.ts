import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RewardActivityType = 
  | 'account_creation'
  | 'kyc_completion'
  | 'contact_sync'
  | 'user_invitation'
  | 'first_transaction'
  | 'transaction_volume'
  | 'transaction_frequency'
  | 'p2p_trade'
  | 'marketplace_purchase'
  | 'monthly_retention';

export const useRewardTracking = () => {
  const trackActivity = useCallback(async (
    activityType: RewardActivityType,
    metadata: Record<string, any> = {}
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('award-activity-points', {
        body: {
          activity_type: activityType,
          metadata,
        },
      });

      if (error) {
        console.error('Error tracking activity:', error);
        return null;
      }

      if (data?.points_awarded > 0) {
        toast.success(`+${data.points_awarded} points earned!`, {
          description: activityType.split('_').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' '),
          duration: 3000,
        });
      }

      return data;
    } catch (error: any) {
      console.error('Error tracking reward activity:', error);
      return null;
    }
  }, []);

  return { trackActivity };
};
