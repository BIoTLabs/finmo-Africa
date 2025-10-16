import { Activity, TrendingUp, Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ExplorerStatsProps {
  totalTransactions: number;
  totalVolume: { token: string; amount: number }[];
  connected: boolean;
}

export const ExplorerStats = ({ totalTransactions, totalVolume, connected }: ExplorerStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold">{totalTransactions}</p>
          </div>
          <Activity className="h-8 w-8 text-primary" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">24h Volume</p>
            {totalVolume.map((vol) => (
              <p key={vol.token} className="text-lg font-semibold">
                {vol.amount.toFixed(2)} {vol.token}
              </p>
            ))}
          </div>
          <TrendingUp className="h-8 w-8 text-green-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Network Status</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <p className="text-sm font-semibold">
                {connected ? 'Live' : 'Connecting...'}
              </p>
            </div>
          </div>
          <Zap className={`h-8 w-8 ${connected ? 'text-green-500' : 'text-muted-foreground'}`} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Platform</p>
            <p className="text-2xl font-bold">FinMo</p>
          </div>
          <Users className="h-8 w-8 text-blue-500" />
        </div>
      </Card>
    </div>
  );
};
