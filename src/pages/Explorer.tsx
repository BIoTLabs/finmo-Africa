import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, ArrowRightLeft, ShoppingCart, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRealtimeExplorer } from "@/hooks/useRealtimeExplorer";
import { useRealtimeP2PExplorer } from "@/hooks/useRealtimeP2PExplorer";
import { useRealtimeMarketplaceExplorer } from "@/hooks/useRealtimeMarketplaceExplorer";
import { useRealtimeStakingExplorer } from "@/hooks/useRealtimeStakingExplorer";
import { useWalletTransparency } from "@/hooks/useWalletTransparency";
import { ExplorerTransactionCard } from "@/components/ExplorerTransactionCard";
import { ExplorerP2PCard } from "@/components/ExplorerP2PCard";
import { ExplorerMarketplaceCard } from "@/components/ExplorerMarketplaceCard";
import { ExplorerStakingCard } from "@/components/ExplorerStakingCard";
import { ExplorerStats } from "@/components/ExplorerStats";
import LoadingScreen from "@/components/LoadingScreen";

const Explorer = () => {
  const navigate = useNavigate();
  const [tokenFilter, setTokenFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchAddress, setSearchAddress] = useState<string>("");

  const { transactions, loading: txLoading, connected: txConnected } = useRealtimeExplorer({
    tokenFilter,
    typeFilter,
    searchAddress,
  });
  const { orders: p2pOrders, loading: p2pLoading, connected: p2pConnected } = useRealtimeP2PExplorer();
  const { orders: marketplaceOrders, loading: marketplaceLoading, connected: marketplaceConnected } = useRealtimeMarketplaceExplorer();
  const { positions: stakingPositions, loading: stakingLoading, connected: stakingConnected } = useRealtimeStakingExplorer();
  const { hotWallet, coldStorage, staked, loading: transparencyLoading } = useWalletTransparency();

  // Calculate stats
  const totalVolume = transactions.reduce((acc, tx) => {
    const existing = acc.find(v => v.token === tx.token);
    if (existing) {
      existing.amount += tx.amount;
    } else {
      acc.push({ token: tx.token, amount: tx.amount });
    }
    return acc;
  }, [] as { token: string; amount: number }[]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">FinMo Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Real-time platform transparency
              </p>
            </div>
          </div>

          <ExplorerStats
            totalTransactions={transactions.length}
            totalVolume={totalVolume}
            connected={txConnected}
            hotWallet={hotWallet}
            coldStorage={coldStorage}
            staked={staked}
            loading={transparencyLoading}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="transactions" className="gap-2">
              <Activity className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="p2p" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              P2P
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="staking" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Staking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            {txLoading ? (
              <LoadingScreen />
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <ExplorerTransactionCard key={tx.id} transaction={tx} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="p2p" className="space-y-4">
            {p2pLoading ? (
              <LoadingScreen />
            ) : p2pOrders.length === 0 ? (
              <div className="text-center py-12">
                <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No P2P orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {p2pOrders.map((order) => (
                  <ExplorerP2PCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-4">
            {marketplaceLoading ? (
              <LoadingScreen />
            ) : marketplaceOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No marketplace orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {marketplaceOrders.map((order) => (
                  <ExplorerMarketplaceCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="staking" className="space-y-4">
            {stakingLoading ? (
              <LoadingScreen />
            ) : stakingPositions.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No staking positions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stakingPositions.map((position) => (
                  <ExplorerStakingCard key={position.id} position={position} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Explorer;
