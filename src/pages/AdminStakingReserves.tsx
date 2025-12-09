import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Lock, TrendingUp, Users, RefreshCw, Percent } from 'lucide-react';
import { toast } from 'sonner';
import LoadingScreen from '@/components/LoadingScreen';

interface StakingReserve {
  id: string;
  token: string;
  total_staked: number;
  pending_rewards: number;
  reserve_balance: number;
  updated_at: string;
}

interface StakingPool {
  id: string;
  token: string;
  apy_rate: number;
  min_stake: number;
  max_stake: number | null;
  lock_period_days: number;
  total_staked: number;
  pool_capacity: number | null;
  is_active: boolean;
}

interface StakingPosition {
  id: string;
  user_id: string;
  token: string;
  staked_amount: number;
  apy_rate: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: string;
  rewards_earned: number;
}

const AdminStakingReserves = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [loading, setLoading] = useState(true);
  const [reserves, setReserves] = useState<StakingReserve[]>([]);
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [stats, setStats] = useState({
    totalStaked: 0,
    totalUsers: 0,
    activePositions: 0,
    pendingRewards: 0
  });

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
      // Load reserves
      const { data: reservesData, error: reservesError } = await supabase
        .from('staking_reserves')
        .select('*')
        .order('token');

      if (reservesError) throw reservesError;
      setReserves(reservesData || []);

      // Load pools
      const { data: poolsData, error: poolsError } = await supabase
        .from('staking_pools')
        .select('*')
        .order('token')
        .order('lock_period_days');

      if (poolsError) throw poolsError;
      setPools(poolsData || []);

      // Load active positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('staking_positions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Calculate stats
      const totalStaked = (reservesData || []).reduce((sum, r) => sum + r.total_staked, 0);
      const pendingRewards = (reservesData || []).reduce((sum, r) => sum + r.pending_rewards, 0);
      const uniqueUsers = new Set((positionsData || []).map(p => p.user_id)).size;

      setStats({
        totalStaked,
        totalUsers: uniqueUsers,
        activePositions: (positionsData || []).length,
        pendingRewards
      });

    } catch (error) {
      console.error('Error loading staking data:', error);
      toast.error('Failed to load staking data');
    } finally {
      setLoading(false);
    }
  };

  const togglePoolStatus = async (poolId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('staking_pools')
        .update({ is_active: !currentStatus })
        .eq('id', poolId);

      if (error) throw error;
      toast.success(`Pool ${!currentStatus ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (error) {
      console.error('Error updating pool:', error);
      toast.error('Failed to update pool');
    }
  };

  const getPoolUtilization = (pool: StakingPool) => {
    if (!pool.pool_capacity) return null;
    return (pool.total_staked / pool.pool_capacity) * 100;
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
              <h1 className="text-3xl font-bold">Staking Reserves</h1>
              <p className="text-muted-foreground">Manage staking pools and reserves</p>
            </div>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/20 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Total Staked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalStaked.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Across all tokens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Stakers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Unique users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Active Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePositions}</div>
              <p className="text-xs text-muted-foreground">Currently staking</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Pending Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.pendingRewards.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Liability to users</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reserves" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reserves">Reserves</TabsTrigger>
            <TabsTrigger value="pools">Pools</TabsTrigger>
            <TabsTrigger value="positions">Active Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="reserves">
            <Card>
              <CardHeader>
                <CardTitle>Staking Reserves by Token</CardTitle>
                <CardDescription>Current reserve balances and liabilities</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Total Staked</TableHead>
                      <TableHead>Pending Rewards</TableHead>
                      <TableHead>Total Liability</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reserves.map((reserve) => (
                      <TableRow key={reserve.id}>
                        <TableCell className="font-medium">{reserve.token}</TableCell>
                        <TableCell>{reserve.total_staked.toFixed(4)}</TableCell>
                        <TableCell className="text-amber-600">{reserve.pending_rewards.toFixed(4)}</TableCell>
                        <TableCell className="font-semibold">
                          {(reserve.total_staked + reserve.pending_rewards).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(reserve.updated_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {reserves.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No staking reserves yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pools">
            <Card>
              <CardHeader>
                <CardTitle>Staking Pools</CardTitle>
                <CardDescription>Manage available staking pools</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>APY</TableHead>
                      <TableHead>Min/Max Stake</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pools.map((pool) => {
                      const utilization = getPoolUtilization(pool);
                      return (
                        <TableRow key={pool.id}>
                          <TableCell className="font-medium">{pool.token}</TableCell>
                          <TableCell>{pool.lock_period_days} days</TableCell>
                          <TableCell className="text-primary font-semibold">{pool.apy_rate}%</TableCell>
                          <TableCell>
                            {pool.min_stake} - {pool.max_stake || '∞'}
                          </TableCell>
                          <TableCell>
                            {pool.pool_capacity ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full" 
                                    style={{ width: `${Math.min(utilization || 0, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs">{utilization?.toFixed(0)}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unlimited</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pool.is_active ? "default" : "secondary"}>
                              {pool.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePoolStatus(pool.id, pool.is_active)}
                            >
                              {pool.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions">
            <Card>
              <CardHeader>
                <CardTitle>Active Staking Positions</CardTitle>
                <CardDescription>Current user stakes (limited to 50)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>APY</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-mono text-xs">
                          {position.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">{position.token}</TableCell>
                        <TableCell>{position.staked_amount.toFixed(4)}</TableCell>
                        <TableCell className="text-primary">{position.apy_rate}%</TableCell>
                        <TableCell>{position.duration_days} days</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(position.start_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(position.end_date).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {positions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No active staking positions
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

export default AdminStakingReserves;