import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Use2FAReturn {
  isEnrolling: boolean;
  isVerifying: boolean;
  qrCode: string | null;
  secret: string | null;
  enrollMFA: () => Promise<void>;
  verifyMFA: (code: string) => Promise<boolean>;
  unenrollMFA: () => Promise<void>;
  challengeMFA: () => Promise<string | null>;
  verifyChallenge: (factorId: string, code: string) => Promise<boolean>;
}

export const use2FA = (): Use2FAReturn => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const enrollMFA = async () => {
    setIsEnrolling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for existing factors and clean up unverified ones
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      
      // Only attempt cleanup if we successfully got factors and they exist
      if (!listError && factors?.totp && factors.totp.length > 0) {
        // Remove any existing unverified factors to allow fresh enrollment
        for (const factor of factors.totp) {
          if (factor.status === "unverified") {
            try {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
            } catch (unenrollError) {
              console.error("Failed to cleanup unverified factor:", unenrollError);
              // Continue with enrollment even if cleanup fails
            }
          }
        }
      }

      // Enroll TOTP (Time-based One-Time Password)
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "FinMo 2FA",
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
    } catch (error: any) {
      console.error("2FA enrollment error:", error);
      toast.error(error.message || "Failed to enroll 2FA");
      throw error;
    } finally {
      setIsEnrolling(false);
    }
  };

  const verifyMFA = async (code: string): Promise<boolean> => {
    setIsVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get all factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      if (!factors || factors.totp.length === 0) {
        throw new Error("No 2FA factor found");
      }

      // Get the factor ID of the most recent unenrolled factor
      const factor = factors.totp.find(f => f.status === "unverified");
      if (!factor) throw new Error("No unverified factor found");

      // Verify the TOTP code
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });

      if (error) throw error;

      toast.success("2FA enabled successfully!");
      setQrCode(null);
      setSecret(null);
      return true;
    } catch (error: any) {
      console.error("2FA verification error:", error);
      toast.error(error.message || "Invalid verification code");
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const unenrollMFA = async () => {
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) throw listError;
      
      if (!factors || !factors.totp || factors.totp.length === 0) {
        toast.info("No 2FA is currently enabled");
        return;
      }

      // Unenroll all factors (both verified and unverified)
      for (const factor of factors.totp) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (error) throw error;
      }

      toast.success("2FA disabled successfully");
    } catch (error: any) {
      console.error("2FA unenroll error:", error);
      toast.error(error.message || "Failed to disable 2FA");
      throw error;
    }
  };

  const challengeMFA = async (): Promise<string | null> => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      if (!factors || factors.totp.length === 0) {
        return null;
      }

      // Get the first verified factor
      const factor = factors.totp.find(f => f.status === "verified");
      if (!factor) return null;

      // Create a challenge
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (error) throw error;

      return factor.id;
    } catch (error: any) {
      console.error("2FA challenge error:", error);
      return null;
    }
  };

  const verifyChallenge = async (factorId: string, code: string): Promise<boolean> => {
    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError || !challengeData) throw challengeError;

      // Then verify with the challenge ID
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error("2FA challenge verification error:", error);
      toast.error("Invalid 2FA code");
      return false;
    }
  };

  return {
    isEnrolling,
    isVerifying,
    qrCode,
    secret,
    enrollMFA,
    verifyMFA,
    unenrollMFA,
    challengeMFA,
    verifyChallenge,
  };
};
