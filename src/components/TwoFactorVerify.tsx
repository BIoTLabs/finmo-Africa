import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface TwoFactorVerifyProps {
  open: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
}

const TwoFactorVerify = ({ open, onVerify, onCancel }: TwoFactorVerifyProps) => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    const success = await onVerify(code);
    setIsVerifying(false);
    
    if (success) {
      setCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="2fa-code">Verification Code</Label>
            <Input
              id="2fa-code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isVerifying}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
              className="flex-1"
            >
              {isVerifying && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              Verify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorVerify;
