import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, TrendingUp, Lock, Unlock, Calendar, Percent, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WalletBalance {
  token: string;
  balance: number;
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
  token: string;
  staked_amount: number;
  duration_days: number;
  apy_rate: number;
  rewards_earned: number;
  start_date: string;
  end_date: string;
  status: string;
  withdrawn_at: string | null;
}

const Staking = () => {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([]);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedPoolId, setSelectedPoolId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load balances, pools, and positions in parallel
      const [balanceResult, poolsResult, positionsResult] = await Promise.all([
        supabase.from("wallet_balances").select("*").eq("user_id", session.user.id),
        supabase.from("staking_pools").select("*").eq("is_active", true).order("token").order("lock_period_days"),
        supabase.from("staking_positions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false })
      ]);

      if (balanceResult.error) throw balanceResult.error;
      if (poolsResult.error) throw poolsResult.error;
      if (positionsResult.error) throw positionsResult.error;

      setBalances(balanceResult.data || []);
      setStakingPools(poolsResult.data || []);
      setStakingPositions(positionsResult.data || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load staking data");
    } finally {
      setLoading(false);
    }
  };

  // Get available tokens from pools
  const availableTokens = [...new Set(stakingPools.map(p => p.token))];
  
  // Get pools for selected token
  const poolsForToken = stakingPools.filter(p => p.token === selectedToken);
  
  // Get selected pool
  const selectedPool = stakingPools.find(p => p.id === selectedPoolId);

  const calculateEstimatedRewards = () => {
    if (!amount || !selectedPool) return 0;
    const amountNum = parseFloat(amount);
    return (amountNum * selectedPool.apy_rate / 100) * (selectedPool.lock_period_days / 365);
  };

  const getPoolUtilization = (pool: StakingPool) => {
    if (!pool.pool_capacity) return 0;
    return (pool.total_staked / pool.pool_capacity) * 100;
  };

  const handleStake = async () => {
    if (!selectedToken || !amount || !selectedPoolId) {
      toast.error("Please fill in all fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const balance = balances.find(b => b.token === selectedToken);
    if (!balance || balance.balance < amountNum) {
      toast.error("Insufficient balance");
      return;
    }

    if (!selectedPool) {
      toast.error("Please select a staking pool");
      return;
    }

    if (amountNum < selectedPool.min_stake) {
      toast.error(`Minimum stake is ${selectedPool.min_stake} ${selectedToken}`);
      return;
    }

    if (selectedPool.max_stake && amountNum > selectedPool.max_stake) {
      toast.error(`Maximum stake is ${selectedPool.max_stake} ${selectedToken}`);
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-staking', {
        body: {
          action: 'create',
          token: selectedToken,
          amount: amountNum,
          duration_days: selectedPool.lock_period_days,
          pool_id: selectedPoolId
        }
      });

      if (error) throw error;

      toast.success(data.message || "Staking position created successfully!");
      setAmount("");
      setSelectedPoolId("");
      await loadData();
    } catch (error: any) {
      console.error("Error staking:", error);
      toast.error(error.message || "Failed to create staking position");
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async (stakeId: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-staking', {
        body: {
          action: 'withdraw',
          stake_id: stakeId
        }
      });

      if (error) throw error;

      toast.success(data.message || "Withdrawal completed successfully!");
      await loadData();
    } catch (error: any) {
      console.error("Error withdrawing:", error);
      toast.error(error.message || "Failed to withdraw stake");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const isMatured = (endDate: string) => {
    return new Date(endDate) <= new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const estimatedRewards = calculateEstimatedRewards();

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileNav />
      
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold">Staking</h1>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">
              Live
            </Badge>
          </div>
        </div>
        <p className="text-primary-foreground/80 text-sm">
          Earn passive income by staking your tokens
        </p>
      </div>

      {/* About Staking */}
      <div className="px-6 pt-6">
        <Collapsible>
          <Card className="shadow-finmo-md bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full p-6 h-auto flex items-center justify-between hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">About Staking</h2>
                </div>
                <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-6 pb-6 pt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Lock your tokens for a fixed period and earn passive rewards through our staking program.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Lock className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Secure & Transparent</p>
                      <p className="text-xs text-muted-foreground">Your tokens are locked with guaranteed returns</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Percent className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Competitive APY Rates</p>
                      <p className="text-xs text-muted-foreground">Earn 3.5-10% APY based on token and duration</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Multiple Duration Options</p>
                      <p className="text-xs text-muted-foreground">Choose from 30 to 365 days - longer durations earn higher rewards</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Unlock className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Early Withdrawal Available</p>
                      <p className="text-xs text-muted-foreground">Withdraw anytime with a 50% penalty on rewards, or wait for maturity to get full rewards</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Create Stake Form */}
      <div className="p-6 space-y-6">
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Create New Stake</h2>
            </div>

            {stakingPools.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No staking pools available at the moment.</p>
                <p className="text-sm mt-2">Check back soon!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Select Token</Label>
                  <Select 
                    value={selectedToken} 
                    onValueChange={(value) => {
                      setSelectedToken(value);
                      setSelectedPoolId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose token" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTokens.map((token) => {
                        const balance = balances.find(b => b.token === token);
                        return (
                          <SelectItem key={token} value={token}>
                            {token} (Available: {balance?.balance.toFixed(2) || '0.00'})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedToken && (
                  <div>
                    <Label>Select Pool (Duration & APY)</Label>
                    <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose staking pool" />
                      </SelectTrigger>
                      <SelectContent>
                        {poolsForToken.map((pool) => {
                          const utilization = getPoolUtilization(pool);
                          return (
                            <SelectItem key={pool.id} value={pool.id}>
                              {pool.lock_period_days} days @ {pool.apy_rate}% APY
                              {pool.pool_capacity && (
                                <span className="text-muted-foreground ml-2">
                                  ({utilization.toFixed(0)}% filled)
                                </span>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Amount to Stake</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={selectedPool?.min_stake || 1}
                    max={selectedPool?.max_stake || undefined}
                    step="0.01"
                  />
                  {selectedPool && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Min: {selectedPool.min_stake} {selectedToken}
                      {selectedPool.max_stake && ` • Max: ${selectedPool.max_stake} ${selectedToken}`}
                    </p>
                  )}
                </div>

                {selectedPool && amount && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">APY Rate:</span>
                      <span className="font-semibold text-primary">{selectedPool.apy_rate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lock Period:</span>
                      <span className="font-semibold">{selectedPool.lock_period_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Rewards:</span>
                      <span className="font-semibold text-green-600">
                        +{estimatedRewards.toFixed(4)} {selectedToken}
                      </span>
                    </div>
                    {selectedPool.pool_capacity && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pool Capacity:</span>
                        <span>{selectedPool.total_staked.toFixed(0)} / {selectedPool.pool_capacity.toFixed(0)} {selectedToken}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleStake}
                  disabled={!selectedToken || !amount || !selectedPoolId || processing}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Stake {amount ? `${amount} ${selectedToken}` : 'Tokens'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Stakes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Staking Positions</h3>
          
          {stakingPositions.length === 0 ? (
            <Card className="shadow-finmo-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                <p>No staking positions yet</p>
                <p className="text-xs mt-2">Create your first stake to start earning rewards</p>
              </CardContent>
            </Card>
          ) : (
            stakingPositions.map((stake) => {
              const matured = isMatured(stake.end_date);
              const daysLeft = getDaysRemaining(stake.end_date);
              const isActive = stake.status === 'active';

              return (
                <Card key={stake.id} className="shadow-finmo-sm">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                            {stake.token[0]}
                          </div>
                          <div>
                            <p className="font-semibold">{stake.token}</p>
                            <p className="text-sm text-muted-foreground">
                              {stake.staked_amount.toFixed(2)} staked
                            </p>
                          </div>
                        </div>
                        <Badge variant={isActive ? (matured ? "default" : "secondary") : "outline"}>
                          {isActive ? (matured ? "Matured" : "Active") : "Withdrawn"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Percent className="w-3 h-3" />
                            <span>APY Rate</span>
                          </div>
                          <p className="font-semibold">{stake.apy_rate}%</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <Calendar className="w-3 h-3" />
                            <span>Duration</span>
                          </div>
                          <p className="font-semibold">{stake.duration_days} days</p>
                        </div>
                      </div>

                      <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Start Date:</span>
                          <span>{formatDate(stake.start_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">End Date:</span>
                          <span>{formatDate(stake.end_date)}</span>
                        </div>
                        {isActive && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Days Remaining:</span>
                            <span className="font-semibold">{daysLeft} days</span>
                          </div>
                        )}
                        {stake.status === 'withdrawn' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rewards Earned:</span>
                            <span className="font-semibold text-green-600">
                              +{stake.rewards_earned.toFixed(4)} {stake.token}
                            </span>
                          </div>
                        )}
                      </div>

                      {isActive && (
                        <Button
                          onClick={() => handleWithdraw(stake.id)}
                          variant={matured ? "default" : "outline"}
                          className="w-full"
                          disabled={processing}
                        >
                          {processing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Unlock className="w-4 h-4 mr-2" />
                              {matured ? "Withdraw (Full Rewards)" : "Early Withdraw (50% Penalty)"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Staking;