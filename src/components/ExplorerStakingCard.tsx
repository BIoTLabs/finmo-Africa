import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ExplorerStakingPosition } from "@/hooks/useRealtimeStakingExplorer";
import { TrendingUp } from "lucide-react";

interface ExplorerStakingCardProps {
  position: ExplorerStakingPosition;
}

export const ExplorerStakingCard = ({ position }: ExplorerStakingCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'withdrawn':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">Staking</Badge>
              <Badge className={getStatusColor(position.status)}>
                {position.status}
              </Badge>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">APY:</span>
                <span className="font-medium text-green-500">
                  {position.apy_rate}%
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {position.duration_days} days
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rewards Earned:</span>
                <span className="font-medium text-green-500">
                  {position.rewards_earned.toFixed(4)} {position.token}
                </span>
              </div>

              {position.withdrawn_at && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Withdrawn:</span>
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(position.withdrawn_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Staked {formatDistanceToNow(new Date(position.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold">
            {position.staked_amount} {position.token}
          </div>
          <div className="text-sm text-green-500">
            +{position.rewards_earned.toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
};
