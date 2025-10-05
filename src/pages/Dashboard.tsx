import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, Users, Settings, ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Token {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [tokens] = useState<Token[]>([
    { symbol: "USDC", name: "USD Coin", balance: 1250.50, usdValue: 1250.50 },
    { symbol: "MATIC", name: "Polygon", balance: 45.32, usdValue: 35.12 },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem("finmo_user");
    if (!userData) {
      navigate("/auth");
      return;
    }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const totalUsdValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);

  const recentTransactions = [
    {
      id: 1,
      type: "received",
      from: "+234 801 234 5678",
      amount: 50,
      token: "USDC",
      timestamp: "2 hours ago",
      isInternal: true,
    },
    {
      id: 2,
      type: "sent",
      to: "+254 712 345 678",
      amount: 25,
      token: "USDC",
      timestamp: "1 day ago",
      isInternal: true,
    },
    {
      id: 3,
      type: "sent",
      to: "0x742d...8a9f",
      amount: 10,
      token: "MATIC",
      timestamp: "3 days ago",
      isInternal: false,
    },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm opacity-90">Welcome back</p>
            <h1 className="text-xl font-semibold">{user.phone}</h1>
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
        {tokens.map((token) => (
          <Card key={token.symbol} className="shadow-finmo-sm hover:shadow-finmo-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                    {token.symbol[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{token.symbol}</p>
                    <p className="text-sm text-muted-foreground">{token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {balanceVisible ? token.balance.toFixed(2) : "••••"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {balanceVisible ? `$${token.usdValue.toFixed(2)}` : "••••"}
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
        {recentTransactions.map((tx) => (
          <Card key={tx.id} className="shadow-finmo-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === "received" ? "bg-success/10" : "bg-primary/10"
                }`}>
                  {tx.type === "received" ? (
                    <ArrowDownLeft className="w-5 h-5 text-success" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">
                      {tx.type === "received" ? "Received" : "Sent"}
                    </p>
                    {tx.isInternal && (
                      <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                        Instant
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tx.type === "received" ? `From ${tx.from}` : `To ${(tx as any).to}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.timestamp}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    tx.type === "received" ? "text-success" : "text-foreground"
                  }`}>
                    {tx.type === "received" ? "+" : "-"}{tx.amount} {tx.token}
                  </p>
                  {!tx.isInternal && (
                    <p className="text-xs text-muted-foreground">On-chain</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
