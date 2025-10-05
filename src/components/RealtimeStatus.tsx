import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "./ui/badge";

interface RealtimeStatusProps {
  connected: boolean;
}

const RealtimeStatus = ({ connected }: RealtimeStatusProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!connected) {
      setShow(true);
    } else {
      // Show briefly when reconnected
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connected]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <Badge 
        variant={connected ? "default" : "destructive"}
        className="flex items-center gap-2"
      >
        {connected ? (
          <>
            <Wifi className="w-3 h-3" />
            Real-time Connected
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            Offline
          </>
        )}
      </Badge>
    </div>
  );
};

export default RealtimeStatus;
