import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PhoneVerificationDialogProps {
  open: boolean;
  phoneNumber: string;
  onVerify: (otp: string) => Promise<boolean>;
  onResend: () => Promise<void>;
  onCancel: () => void;
}

export const PhoneVerificationDialog = ({
  open,
  phoneNumber,
  onVerify,
  onResend,
  onCancel,
}: PhoneVerificationDialogProps) => {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    
    setIsVerifying(true);
    try {
      await onVerify(otp);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResend();
      setOtp("");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Phone Number</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code sent to {phoneNumber}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={isVerifying}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={otp.length !== 6 || isVerifying}
              className="flex-1"
            >
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
            
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend Code
            </Button>
          </div>

          <Button variant="ghost" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};