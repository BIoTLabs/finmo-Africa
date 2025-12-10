import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, Users, Settings, ArrowUpRight, ArrowDownLeft, Eye, EyeOff, RefreshCw, Coins, User, Mail, Clock, TrendingUp, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useRealtimeBalance } from "@/hooks/useRealtimeBalance";
import { useAutoBalanceSync } from "@/hooks/useAutoBalanceSync";
import RealtimeStatus from "@/components/RealtimeStatus";
import { RewardsNotification } from "@/components/RewardsNotification";
import { MainnetBanner } from "@/components/MainnetBanner";
import { NotificationBell } from "@/components/NotificationBell";
import { TransactionLimitsCard } from "@/components/TransactionLimitsCard";
import finmoLogo from "@/assets/finmo-logo.png";
import { getTokenInfo } from "@/utils/tokenInfo";

interface WalletBalance {
  token: string;
  balance: number;
}

interface Transaction {
  id: string;
  amount: number;
  token: string;
  transaction_type: string;
  created_at: string;
  sender_wallet: string;
  recipient_wallet: string;
  sender_id: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Use real-time hooks
  const { transactions, connected } = useRealtimeTransactions(userId);
  const { balances } = useRealtimeBalance(userId);
  
  // Auto-sync blockchain balances every 2 minutes
  useAutoBalanceSync(userId, profile?.wallet_address);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUserId(session.user.id);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      toast.error("Unable to load your wallet data. This may be a temporary issue. Please refresh the page or contact support if the problem continues.");
    } else {
      setProfile(profileData);
      
      // Defensive check: Generate wallet if missing
      if (profileData && !profileData.wallet_address) {
        try {
          const { error: walletError } = await supabase.functions.invoke('generate-user-wallet');
          if (walletError) {
            console.error("Wallet generation error:", walletError);
          } else {
            // Reload profile to get the new wallet address
            loadUserData();
          }
        } catch (error) {
          console.error("Wallet generation failed:", error);
        }
      }
    }
  };

  // Aggregate balances by token across all chains for display
  const aggregatedBalances = balances.reduce((acc, b) => {
    const existing = acc.find(item => item.token === b.token);
    if (existing) {
      existing.balance += Number(b.balance);
    } else {
      acc.push({ 
        token: b.token, 
        balance: Number(b.balance),
        id: b.id,
        user_id: b.user_id,
        updated_at: b.updated_at
      });
    }
    return acc;
  }, [] as typeof balances);

  const totalUsdValue = aggregatedBalances.reduce((sum, b) => sum + b.balance, 0);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleSyncBlockchain = async () => {
    setSyncing(true);
    try {
      toast.info("Refreshing balances...");
      
      // Simply reload the page to refresh all data
      window.location.reload();
      
      toast.success("Balance refresh completed!");
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error("We couldn't sync your blockchain data. Please try again later.");
    } finally {
      setSyncing(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileNav />
      <RealtimeStatus connected={connected} />
      <MainnetBanner />
      <RewardsNotification userId={userId} />
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <img src={finmoLogo} alt="FinMo" className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm opacity-90">Welcome back</p>
              <h1 className="text-base sm:text-xl font-semibold truncate">
                {profile.display_name || profile.phone_number}
              </h1>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/20 w-9 h-9 sm:w-10 sm:h-10"
              onClick={() => navigate("/profile")}
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/20 w-9 h-9 sm:w-10 sm:h-10"
              onClick={() => navigate("/settings")}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm opacity-90">Total Balance</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-white/80 hover:bg-white/20 text-xs px-2"
                    onClick={handleSyncBlockchain}
                    disabled={syncing}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? "Syncing..." : "Sync"}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-bold">
                    {balanceVisible ? `$${totalUsdValue.toFixed(2)}` : "••••••"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary-foreground hover:bg-white/20 h-8 w-8"
                    onClick={() => setBalanceVisible(!balanceVisible)}
                  >
                    {balanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Wallet className="w-8 h-8 opacity-90" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => navigate("/send")}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
              <Button
                onClick={() => navigate("/receive")}
                variant="secondary"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Receive
              </Button>
              <Button
                onClick={() => navigate("/request-payment")}
                variant="outline"
              >
                <Mail className="w-4 h-4 mr-2" />
                Request
              </Button>
              <Button
                onClick={() => navigate("/all-transactions")}
                variant="outline"
              >
                <Clock className="w-4 h-4 mr-2" />
                History
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                onClick={() => navigate("/p2p")}
                variant="outline"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                P2P
              </Button>
              <Button
                onClick={() => navigate("/staking")}
                variant="outline"
                className="bg-success/10 border-success/30 hover:bg-success/20"
              >
                <TrendingUp className="w-4 h-4 mr-2 text-success" />
                Staking
              </Button>
              <Button
                onClick={() => navigate("/rewards")}
                variant="outline"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Rewards
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Limits */}
      <div className="px-6 pt-4">
        <TransactionLimitsCard userId={userId} />
      </div>

      {/* Token List */}
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Your Assets</h3>
        {aggregatedBalances.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No assets yet</p>
              <p className="text-xs mt-2">Deposit crypto to get started</p>
            </CardContent>
          </Card>
        ) : (
          aggregatedBalances.map((balance, index) => {
            const tokenInfo = getTokenInfo(balance.token);
            return (
              <Card 
                key={balance.token} 
                className="shadow-finmo-sm hover:shadow-finmo-md transition-all hover-scale animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-xl">
                        {tokenInfo.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{balance.token}</p>
                        <p className="text-sm text-muted-foreground">{tokenInfo.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {balanceVisible ? Number(balance.balance).toFixed(balance.token === 'WBTC' ? 4 : 2) : "••••"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {balanceVisible ? `$${Number(balance.balance).toFixed(2)}` : "••••"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Recent Transactions */}
      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          {transactions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/all-transactions")}>
              View All
            </Button>
          )}
        </div>
        {transactions.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No transactions yet</p>
              <p className="text-xs mt-2">Send or receive crypto to see your activity here</p>
            </CardContent>
          </Card>
        ) : (
          transactions.slice(0, 5).map((tx) => {
            const isReceived = tx.recipient_id === profile?.id;
            const isInternal = tx.transaction_type === 'internal';
            const isDeposit = tx.transaction_type === 'deposit';
            const isWithdrawal = tx.transaction_type === 'withdrawal' || (tx.transaction_type === 'external' && !isReceived);
            const isBlockchain = isDeposit || isWithdrawal || tx.transaction_type === 'external';
            
            return (
              <Card 
                key={tx.id} 
                className="shadow-finmo-sm hover:shadow-finmo-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/transaction/${tx.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isReceived ? "bg-success/10" : "bg-primary/10"
                    }`}>
                      {isReceived ? (
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">
                          {isDeposit ? "Blockchain Deposit" : isWithdrawal ? "Blockchain Withdrawal" : isReceived ? "Received" : "Sent"}
                        </p>
                        {isInternal && (
                          <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                            Instant
                          </Badge>
                        )}
                        {isBlockchain && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                            On-chain
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isDeposit 
                          ? `From ${tx.sender_wallet.slice(0, 12)}...` 
                          : isWithdrawal
                            ? `To ${tx.recipient_wallet.slice(0, 12)}...`
                            : isReceived 
                              ? `From ${tx.sender_wallet.slice(0, 12)}...` 
                              : `To ${tx.recipient_wallet.slice(0, 12)}...`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTimestamp(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        isReceived ? "text-success" : "text-foreground"
                      }`}>
                        {isReceived ? "+" : "-"}{Number(tx.amount).toFixed(2)} {tx.token}
                      </p>
                      {isBlockchain && tx.transaction_hash && (
                        <p className="text-xs text-muted-foreground">On-chain</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Dashboard;
