import { Activity, TrendingUp, Wallet, Snowflake, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ExplorerStatsProps {
  totalTransactions: number;
  totalVolume: { token: string; amount: number }[];
  connected: boolean;
  hotWallet: { token: string; amount: number }[];
  coldStorage: { token: string; amount: number }[];
  staked: { token: string; amount: number }[];
  loading: boolean;
}

export const ExplorerStats = ({ 
  totalTransactions, 
  totalVolume, 
  connected,
  hotWallet,
  coldStorage,
  staked,
  loading
}: ExplorerStatsProps) => {
  return (
    <div className="space-y-4">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {totalVolume.length === 0 ? (
                <p className="text-lg font-semibold">0.00</p>
              ) : (
                totalVolume.map((vol) => (
                  <p key={vol.token} className="text-lg font-semibold">
                    {vol.amount.toFixed(2)} {vol.token}
                  </p>
                ))
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
            <Activity className={`h-8 w-8 ${connected ? 'text-green-500' : 'text-muted-foreground'}`} />
          </div>
        </Card>
      </div>

      {/* Transparency Stats Row */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Wallet Transparency</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-500" />
                <p className="text-sm font-medium">Hot Wallet (User Balances)</p>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : hotWallet.length === 0 ? (
              <p className="text-lg font-semibold">0.00</p>
            ) : (
              <div className="space-y-1">
                {hotWallet.map((hw) => (
                  <div key={hw.token} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{hw.token}:</span>
                    <span className="text-lg font-semibold">{hw.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Total held in custodial wallet</p>
          </Card>

          <Card className="p-4 border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-purple-500" />
                <p className="text-sm font-medium">Cold Storage</p>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : coldStorage.length === 0 ? (
              <p className="text-lg font-semibold">0.00</p>
            ) : (
              <div className="space-y-1">
                {coldStorage.map((cs) => (
                  <div key={cs.token} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{cs.token}:</span>
                    <span className="text-lg font-semibold">{cs.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Admin withdrawals to cold wallet</p>
          </Card>

          <Card className="p-4 border-green-500/20 bg-green-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-green-500" />
                <p className="text-sm font-medium">Staked Value</p>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : staked.length === 0 ? (
              <p className="text-lg font-semibold">0.00</p>
            ) : (
              <div className="space-y-1">
                {staked.map((st) => (
                  <div key={st.token} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{st.token}:</span>
                    <span className="text-lg font-semibold">{st.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Total locked in staking</p>
          </Card>
        </div>
      </div>
    </div>
  );
};
