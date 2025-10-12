import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TwoFAPreferences {
  require_on_login: boolean;
  require_on_send: boolean;
  require_on_withdraw: boolean;
  require_on_p2p_trade: boolean;
  require_on_marketplace_purchase: boolean;
  require_on_security_changes: boolean;
  require_on_payment_method_changes: boolean;
  require_on_staking: boolean;
}

export const use2FAPreferences = () => {
  const [preferences, setPreferences] = useState<TwoFAPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_2fa_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) {
        // Create default preferences if they don't exist
        const { data: newPrefs, error: insertError } = await supabase
          .from("user_2fa_preferences")
          .insert({
            user_id: user.id,
            require_on_login: true,
            require_on_send: false,
            require_on_withdraw: true,
            require_on_p2p_trade: false,
            require_on_marketplace_purchase: false,
            require_on_security_changes: true,
            require_on_payment_method_changes: false,
            require_on_staking: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences(newPrefs);
      } else {
        setPreferences(data);
      }
    } catch (error: any) {
      console.error("Error fetching 2FA preferences:", error);
      toast.error("Failed to load 2FA preferences");
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof TwoFAPreferences, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_2fa_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) => prev ? { ...prev, [key]: value } : null);
      toast.success("2FA preference updated");
    } catch (error: any) {
      console.error("Error updating 2FA preference:", error);
      toast.error("Failed to update preference");
      throw error;
    }
  };

  const checkIfRequired = async (action: keyof TwoFAPreferences): Promise<boolean> => {
    try {
      // Check if user has 2FA enabled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const has2FA = factors && factors.totp && factors.totp.some(f => f.status === "verified");
      
      if (!has2FA) {
        return false; // User doesn't have 2FA enabled at all
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Fetch preferences directly from database
      const { data: prefs, error } = await supabase
        .from("user_2fa_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching 2FA preferences:", error);
        return false;
      }

      // If no preferences exist, create default ones
      if (!prefs) {
        const { data: newPrefs } = await supabase
          .from("user_2fa_preferences")
          .insert({
            user_id: user.id,
            require_on_login: true,
            require_on_send: false,
            require_on_withdraw: true,
            require_on_p2p_trade: false,
            require_on_marketplace_purchase: false,
            require_on_security_changes: true,
            require_on_payment_method_changes: false,
            require_on_staking: false,
          })
          .select()
          .single();

        return newPrefs?.[action] ?? false;
      }

      return prefs[action] ?? false;
    } catch (error) {
      console.error("Error checking if 2FA required:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  return {
    preferences,
    loading,
    updatePreference,
    checkIfRequired,
    refreshPreferences: fetchPreferences,
  };
};
