import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, Users, Settings, ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

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
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await loadUserData(session.user.id);
  };

  const loadUserData = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load balances
      const { data: balanceData, error: balanceError } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", userId);

      if (balanceError) throw balanceError;
      setBalances(balanceData || []);

      // Load recent transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (txError) throw txError;
      setTransactions(txData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const totalUsdValue = balances.reduce((sum, b) => sum + Number(b.balance), 0);

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

  if (loading || !profile) return null;

  return (
    <div className="min-h-screen bg-muted pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm opacity-90">Welcome back</p>
            <h1 className="text-xl font-semibold">{profile.phone_number}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/settings")}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Total Balance</p>
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

            <div className="flex gap-3">
              <Button
                onClick={() => navigate("/send")}
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
              <Button
                onClick={() => navigate("/contacts")}
                variant="secondary"
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token List */}
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Your Assets</h3>
        {balances.map((balance, index) => (
          <Card 
            key={balance.token} 
            className="shadow-finmo-sm hover:shadow-finmo-md transition-all hover-scale animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                    {balance.token[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{balance.token}</p>
                    <p className="text-sm text-muted-foreground">{balance.token === 'USDC' ? 'USD Coin' : 'Polygon'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {balanceVisible ? Number(balance.balance).toFixed(2) : "••••"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {balanceVisible ? `$${Number(balance.balance).toFixed(2)}` : "••••"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="px-6 pb-6 space-y-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        {transactions.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          transactions.map((tx) => {
            const isReceived = tx.sender_id !== profile.id;
            const isInternal = tx.transaction_type === 'internal';
            
            return (
              <Card key={tx.id} className="shadow-finmo-sm">
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
                          {isReceived ? "Received" : "Sent"}
                        </p>
                        {isInternal && (
                          <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                            Instant
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isReceived ? `From ${tx.sender_wallet.slice(0, 12)}...` : `To ${tx.recipient_wallet.slice(0, 12)}...`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTimestamp(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        isReceived ? "text-success" : "text-foreground"
                      }`}>
                        {isReceived ? "+" : "-"}{Number(tx.amount).toFixed(2)} {tx.token}
                      </p>
                      {!isInternal && (
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
