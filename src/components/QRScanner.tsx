import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";
import { toast } from "sonner";

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: { phone?: string; wallet?: string; isFinMo: boolean }) => void;
}

export const QRScanner = ({ open, onClose, onScan }: QRScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (open && !isScanning) {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Scan failure is normal, ignore
        }
      );
      
      setIsScanning(true);
    } catch (error) {
      console.error("Error starting scanner:", error);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    try {
      // Check if it's the new multi-line format
      if (decodedText.includes('FinMo Wallet') && decodedText.includes('Phone:') && decodedText.includes('ERC-20:')) {
        const lines = decodedText.split('\n');
        const phoneLine = lines.find(line => line.startsWith('Phone:'));
        const walletLine = lines.find(line => line.startsWith('ERC-20:'));
        
        if (phoneLine && walletLine) {
          const phone = phoneLine.replace('Phone:', '').trim();
          const wallet = walletLine.replace('ERC-20:', '').trim();
          
          await stopScanner();
          onScan({
            phone,
            wallet,
            isFinMo: true,
          });
          onClose();
          toast.success("FinMo wallet detected!");
          return;
        }
      }
      
      // Try to parse as JSON (old format)
      try {
        const parsed = JSON.parse(decodedText);
        
        if (parsed.type === 'finmo_wallet' && parsed.phone && parsed.wallet) {
          await stopScanner();
          onScan({
            phone: parsed.phone,
            wallet: parsed.wallet,
            isFinMo: true,
          });
          onClose();
          toast.success("FinMo wallet detected!");
          return;
        }
      } catch {
        // Not JSON, continue to check if it's a wallet address
      }
      
      // Check if it's a valid wallet address
      if (decodedText.match(/^0x[a-fA-F0-9]{40}$/)) {
        await stopScanner();
        onScan({
          wallet: decodedText,
          isFinMo: false,
        });
        onClose();
        toast.success("Wallet address detected!");
      } else {
        toast.error("Invalid QR code format");
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast.error("Failed to process QR code");
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div 
            id="qr-reader" 
            className="w-full rounded-lg overflow-hidden border-2 border-primary"
          />
          
          <p className="text-sm text-muted-foreground text-center">
            Position the QR code within the frame to scan
          </p>
          
          <Button 
            onClick={handleClose} 
            variant="outline" 
            className="w-full"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
