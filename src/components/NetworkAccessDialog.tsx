import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Info } from "lucide-react";
import { detectPrivateNetworkBlock, getBrowserAlternatives, getChromeBypassInstructions } from "@/utils/networkDetection";

export function NetworkAccessDialog() {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check on mount if user might encounter PNA issues
    const isPotentiallyBlocked = detectPrivateNetworkBlock();
    
    // Only show if detected AND user hasn't dismissed before
    const dismissed = localStorage.getItem('pna-warning-dismissed');
    if (isPotentiallyBlocked && !dismissed) {
      // Delay showing to avoid disrupting initial load
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pna-warning-dismissed', 'true');
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-warning" />
            Network Access Notice
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <p>
              You're accessing FinMo on a wireless network using Chrome. If you experience 
              connection issues, this is due to Chrome's Private Network Access security feature.
            </p>
            
            {showDetails && (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Alternative browsers:</strong>
                    <ul className="list-disc list-inside mt-2">
                      {getBrowserAlternatives().map((browser) => (
                        <li key={browser}>{browser}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Chrome workaround:</strong>
                    <p className="mt-2 text-xs">{getChromeBypassInstructions()}</p>
                  </AlertDescription>
                </Alert>
                
                <p className="text-xs text-muted-foreground">
                  Note: We've configured our servers to work with this security feature, 
                  so you should not experience any issues. This notice is informational only.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full sm:w-auto"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </Button>
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Got it
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
