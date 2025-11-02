import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const MainnetBanner = () => {
  return (
    <Alert className="bg-green-600/10 border-green-600/50 mb-4">
      <AlertTriangle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-600 font-medium">
        🟢 Live on Mainnet - You're using real cryptocurrency. Keep your wallet secure!
      </AlertDescription>
    </Alert>
  );
};
