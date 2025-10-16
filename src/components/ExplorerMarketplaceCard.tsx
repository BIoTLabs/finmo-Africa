import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ExplorerMarketplaceOrder } from "@/hooks/useRealtimeMarketplaceExplorer";
import { ShoppingCart, Shield } from "lucide-react";

interface ExplorerMarketplaceCardProps {
  order: ExplorerMarketplaceOrder;
}

export const ExplorerMarketplaceCard = ({ order }: ExplorerMarketplaceCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
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
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">Marketplace</Badge>
              <Badge className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
              {order.escrow_released && (
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Shield className="h-3 w-3 mr-1" />
                  Escrow Released
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Order ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {order.id.slice(0, 8)}...
                </code>
              </div>

              {order.delivered_at && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Delivered:</span>
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(order.delivered_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold">
            {order.amount} {order.currency}
          </div>
        </div>
      </div>
    </div>
  );
};
