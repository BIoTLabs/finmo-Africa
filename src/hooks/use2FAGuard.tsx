import { useState } from "react";
import { use2FA } from "./use2FA";
import { use2FAPreferences, TwoFAPreferences } from "./use2FAPreferences";
import TwoFactorVerify from "@/components/TwoFactorVerify";

export type TwoFAAction = keyof TwoFAPreferences;

interface Use2FAGuardReturn {
  TwoFactorDialog: React.FC;
  requireVerification: (action: TwoFAAction, callback: () => void | Promise<void>) => Promise<void>;
  isVerifying: boolean;
}

export const use2FAGuard = (): Use2FAGuardReturn => {
  const [showVerify, setShowVerify] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void | Promise<void>) | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { challengeMFA, verifyChallenge } = use2FA();
  const { checkIfRequired } = use2FAPreferences();

  const requireVerification = async (
    action: TwoFAAction,
    callback: () => void | Promise<void>
  ) => {
    try {
      setIsVerifying(true);

      // Check if 2FA is required for this action
      const required = await checkIfRequired(action);

      if (!required) {
        // 2FA not required, execute callback immediately
        await callback();
        setIsVerifying(false);
        return;
      }

      // 2FA is required, get factor ID and show dialog
      const fid = await challengeMFA();
      
      if (!fid) {
        // User doesn't have 2FA enabled, execute callback
        await callback();
        setIsVerifying(false);
        return;
      }

      // Show 2FA verification dialog
      setFactorId(fid);
      setPendingCallback(() => callback);
      setShowVerify(true);
    } catch (error) {
      console.error("2FA guard error:", error);
      setIsVerifying(false);
      throw error;
    }
  };

  const handleVerify = async (code: string): Promise<boolean> => {
    if (!factorId) return false;

    try {
      const success = await verifyChallenge(factorId, code);

      if (success && pendingCallback) {
        // Execute the pending callback
        await pendingCallback();
        
        // Clean up
        setShowVerify(false);
        setFactorId(null);
        setPendingCallback(null);
        setIsVerifying(false);
      }

      return success;
    } catch (error) {
      console.error("2FA verification error:", error);
      return false;
    }
  };

  const handleCancel = () => {
    setShowVerify(false);
    setFactorId(null);
    setPendingCallback(null);
    setIsVerifying(false);
  };

  const TwoFactorDialog: React.FC = () => (
    <TwoFactorVerify
      open={showVerify}
      onVerify={handleVerify}
      onCancel={handleCancel}
    />
  );

  return {
    TwoFactorDialog,
    requireVerification,
    isVerifying,
  };
};
