import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { use2FA } from "@/hooks/use2FA";

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TwoFactorSetup = ({ open, onOpenChange, onSuccess }: TwoFactorSetupProps) => {
  const [verificationCode, setVerificationCode] = useState("");
  const { isEnrolling, isVerifying, qrCode, secret, enrollMFA, verifyMFA } = use2FA();
  const [step, setStep] = useState<"enroll" | "verify">("enroll");

  const handleEnroll = async () => {
    try {
      await enrollMFA();
      setStep("verify");
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleVerify = async () => {
    const success = await verifyMFA(verificationCode);
    if (success) {
      onSuccess();
      onOpenChange(false);
      setStep("enroll");
      setVerificationCode("");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("enroll");
    setVerificationCode("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </DialogDescription>
        </DialogHeader>

        {step === "enroll" && (
          <div className="space-y-4">
            <Button
              onClick={handleEnroll}
              disabled={isEnrolling}
              className="w-full"
            >
              {isEnrolling && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              Generate QR Code
            </Button>
          </div>
        )}

        {step === "verify" && qrCode && secret && (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>

              {/* Manual Entry */}
              <div className="w-full p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Can't scan? Enter manually:</p>
                <code className="text-xs font-mono break-all">{secret}</code>
              </div>
            </div>

            {/* Verification Input */}
            <div className="space-y-2">
              <Label htmlFor="code">Enter verification code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full"
            >
              {isVerifying && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              Verify and Enable
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorSetup;
