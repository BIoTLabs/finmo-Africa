import { Activity, TrendingUp, Users, Zap, Wallet, Snowflake, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ExplorerStatsProps {
  totalTransactions: number;
  totalVolume: { token: string; amount: number }[];
  connected: boolean;
  hotWalletBalance?: { token: string; amount: number }[];
  coldStorageTransfers?: { token: string; amount: number }[];
  totalStaked?: { token: string; amount: number }[];
}

export const ExplorerStats = ({ 
  totalTransactions, 
  totalVolume, 
  connected,
  hotWalletBalance = [],
  coldStorageTransfers = [],
  totalStaked = []
}: ExplorerStatsProps) => {
  return (
    <>
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
              {totalVolume.length > 0 ? (
                totalVolume.map((vol) => (
                  <p key={vol.token} className="text-lg font-semibold">
                    {vol.amount.toFixed(2)} {vol.token}
                  </p>
                ))
              ) : (
                <p className="text-lg font-semibold">0.00</p>
              )}
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

      {/* Wallet Transparency Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Wallet Transparency
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hot Wallet (User Balances) */}
          <Card className="p-4 border-orange-500/20 bg-orange-500/5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-4 w-4" />
                  Hot Wallet Holdings
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total user balances</p>
              </div>
            </div>
            <div className="space-y-1">
              {hotWalletBalance.length > 0 ? (
                hotWalletBalance.map((balance) => (
                  <p key={balance.token} className="text-lg font-bold text-orange-600">
                    {balance.amount.toFixed(4)} {balance.token}
                  </p>
                ))
              ) : (
                <p className="text-lg font-bold text-orange-600">0.00</p>
              )}
            </div>
          </Card>

          {/* Cold Storage */}
          <Card className="p-4 border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Snowflake className="h-4 w-4" />
                  Cold Storage
                </p>
                <p className="text-xs text-muted-foreground mt-1">Admin withdrawals from hot wallet</p>
              </div>
            </div>
            <div className="space-y-1">
              {coldStorageTransfers.length > 0 ? (
                coldStorageTransfers.map((transfer) => (
                  <p key={transfer.token} className="text-lg font-bold text-blue-600">
                    {transfer.amount.toFixed(4)} {transfer.token}
                  </p>
                ))
              ) : (
                <p className="text-lg font-bold text-blue-600">0.00</p>
              )}
            </div>
          </Card>

          {/* Staked Value */}
          <Card className="p-4 border-green-500/20 bg-green-500/5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Total Staked
                </p>
                <p className="text-xs text-muted-foreground mt-1">User staking positions</p>
              </div>
            </div>
            <div className="space-y-1">
              {totalStaked.length > 0 ? (
                totalStaked.map((stake) => (
                  <p key={stake.token} className="text-lg font-bold text-green-600">
                    {stake.amount.toFixed(4)} {stake.token}
                  </p>
                ))
              ) : (
                <p className="text-lg font-bold text-green-600">0.00</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};
