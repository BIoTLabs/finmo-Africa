import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export const awardPoints = async (
  userId: string,
  activityType: RewardActivityType,
  metadata: Record<string, any> = {}
) => {
  try {
    const { data, error } = await supabase.rpc("award_points", {
      _user_id: userId,
      _activity_type: activityType,
      _metadata: metadata,
    });

    if (error) throw error;
    
    if (data && data > 0) {
      toast.success(`+${data} points earned!`, {
        description: `Keep engaging to earn more rewards`,
      });
    }
    
    return data;
  } catch (error: any) {
    console.error("Error awarding points:", error);
    return null;
  }
};
