import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, DollarSign, TrendingUp, Wallet, RefreshCw, ArrowUpRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LoadingScreen from '@/components/LoadingScreen';

interface PlatformWallet {
  id: string;
  wallet_type: string;
  wallet_address: string;
  balance: number;
  token: string;
  description: string;
}

interface RevenueEntry {
  id: string;
  revenue_type: string;
  amount: number;
  token: string;
  source_type: string;
  wallet_type: string;
  created_at: string;
  metadata: any;
}

interface RevenueSummary {
  p2p_fees: number;
  marketplace_fees: number;
  withdrawal_fees: number;
  total: number;
}

const AdminRevenue = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<PlatformWallet[]>([]);
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [summary, setSummary] = useState<RevenueSummary>({ p2p_fees: 0, marketplace_fees: 0, withdrawal_fees: 0, total: 0 });
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      toast.error('Access denied');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load platform wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from('platform_wallets')
        .select('*')
        .order('wallet_type');

      if (walletsError) throw walletsError;
      setWallets(walletsData || []);

      // Load recent revenue entries
      const { data: revenueData, error: revenueError } = await supabase
        .from('platform_revenue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (revenueError) throw revenueError;
      setRevenueEntries(revenueData || []);

      // Calculate summary
      const p2p = (revenueData || []).filter(r => r.wallet_type === 'p2p_fees').reduce((sum, r) => sum + r.amount, 0);
      const marketplace = (revenueData || []).filter(r => r.wallet_type === 'marketplace_fees').reduce((sum, r) => sum + r.amount, 0);
      const withdrawal = (revenueData || []).filter(r => r.wallet_type === 'withdrawal_fees').reduce((sum, r) => sum + r.amount, 0);
      
      setSummary({
        p2p_fees: p2p,
        marketplace_fees: marketplace,
        withdrawal_fees: withdrawal,
        total: p2p + marketplace + withdrawal
      });

    } catch (error) {
      console.error('Error loading revenue data:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (walletType: string) => {
    if (!withdrawAddress || !withdrawAmount) {
      toast.error('Please enter address and amount');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    const wallet = wallets.find(w => w.wallet_type === walletType);
    if (!wallet || wallet.balance < amount) {
      toast.error('Insufficient balance');
      return;
    }

    setWithdrawing(walletType);
    try {
      // Create withdrawal record
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('admin_withdrawals').insert({
        admin_id: user?.id,
        wallet_type: walletType,
        amount: amount,
        token: wallet.token,
        destination_address: withdrawAddress,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Withdrawal request created', {
        description: 'The withdrawal will be processed manually for security.'
      });
      
      setWithdrawAddress('');
      setWithdrawAmount('');
      setSelectedWallet(null);
      await loadData();

    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error('Failed to create withdrawal request');
    } finally {
      setWithdrawing(null);
    }
  };

  const formatWalletType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (adminLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Platform Revenue</h1>
              <p className="text-muted-foreground">Manage segregated revenue wallets</p>
            </div>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">P2P Trading Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.p2p_fees.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">0.5% seller fee</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Marketplace Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.marketplace_fees.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Listing & promotion fees</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Withdrawal Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.withdrawal_fees.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">2x gas cost markup</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/20 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${summary.total.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All sources combined</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wallets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="wallets">
              <Wallet className="h-4 w-4 mr-2" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="history">
              <TrendingUp className="h-4 w-4 mr-2" />
              Revenue History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallets" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wallets.map((wallet) => (
                <Card key={wallet.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      {formatWalletType(wallet.wallet_type)}
                    </CardTitle>
                    <CardDescription>{wallet.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold">{wallet.balance.toFixed(4)}</div>
                      <div className="text-sm text-muted-foreground">{wallet.token}</div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground break-all">
                      {wallet.wallet_address}
                    </div>

                    {selectedWallet === wallet.wallet_type ? (
                      <div className="space-y-3 pt-2 border-t">
                        <div>
                          <Label>Destination Address</Label>
                          <Input
                            placeholder="0x..."
                            value={withdrawAddress}
                            onChange={(e) => setWithdrawAddress(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Amount ({wallet.token})</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            max={wallet.balance}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleWithdraw(wallet.wallet_type)}
                            disabled={withdrawing === wallet.wallet_type}
                            className="flex-1"
                          >
                            {withdrawing === wallet.wallet_type ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ArrowUpRight className="h-4 w-4 mr-2" />
                                Withdraw
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedWallet(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setSelectedWallet(wallet.wallet_type)}
                        disabled={wallet.balance <= 0}
                      >
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        Withdraw
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Recent Revenue</CardTitle>
                <CardDescription>Last 100 revenue entries</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.revenue_type.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.source_type}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.amount.toFixed(4)} {entry.token}
                        </TableCell>
                        <TableCell>
                          {formatWalletType(entry.wallet_type)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {revenueEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No revenue entries yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminRevenue;