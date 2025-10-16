import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ExplorerP2POrder } from "@/hooks/useRealtimeP2PExplorer";
import { ArrowRightLeft } from "lucide-react";

interface ExplorerP2PCardProps {
  order: ExplorerP2POrder;
}

export const ExplorerP2PCard = ({ order }: ExplorerP2PCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">P2P Trade</Badge>
              <Badge className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rate:</span>
                <span className="font-medium">
                  1 {order.token} = {order.rate.toFixed(2)} {order.currency_code}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Crypto:</span>
                <span className="font-medium">
                  {order.crypto_amount} {order.token}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Fiat:</span>
                <span className="font-medium">
                  {order.fiat_amount.toFixed(2)} {order.currency_code}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold">
            {order.crypto_amount} {order.token}
          </div>
          <div className="text-sm text-muted-foreground">
            ≈ {order.fiat_amount.toFixed(2)} {order.currency_code}
          </div>
        </div>
      </div>
    </div>
  );
};
