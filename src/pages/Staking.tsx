import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Lock, Unlock, Calendar, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WalletBalance {
  token: string;
  balance: number;
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
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [duration, setDuration] = useState<string>("");

  const durationOptions = [
    { days: 30, label: "30 Days", apy: 5.0 },
    { days: 60, label: "60 Days", apy: 6.5 },
    { days: 90, label: "90 Days", apy: 8.0 },
    { days: 180, label: "180 Days", apy: 10.0 },
    { days: 365, label: "365 Days", apy: 12.0 },
  ];

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

      // Load balances
      const { data: balanceData, error: balanceError } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", session.user.id);

      if (balanceError) throw balanceError;
      setBalances(balanceData || []);

      // Load staking positions
      const { data: stakingData, error: stakingError } = await supabase
        .from("staking_positions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (stakingError) throw stakingError;
      setStakingPositions(stakingData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load staking data");
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedRewards = () => {
    if (!amount || !duration) return 0;
    const amountNum = parseFloat(amount);
    const durationNum = parseInt(duration);
    const selectedDuration = durationOptions.find(d => d.days === durationNum);
    if (!selectedDuration) return 0;
    
    return (amountNum * selectedDuration.apy / 100) * (durationNum / 365);
  };

  const handleStake = async () => {
    if (!selectedToken || !amount || !duration) {
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

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-staking', {
        body: {
          action: 'create',
          token: selectedToken,
          amount: amountNum,
          duration_days: parseInt(duration)
        }
      });

      if (error) throw error;

      toast.success(data.message || "Staking position created successfully!");
      setAmount("");
      setDuration("");
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
        <p>Loading staking...</p>
      </div>
    );
  }

  const selectedDurationData = durationOptions.find(d => d.days.toString() === duration);
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
          <h1 className="text-2xl font-bold">Staking</h1>
        </div>
        <p className="text-primary-foreground/80 text-sm">
          Lock your tokens and earn rewards
        </p>
      </div>

      {/* Create Stake Form */}
      <div className="p-6 space-y-6">
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Create New Stake</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Select Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose token" />
                  </SelectTrigger>
                  <SelectContent>
                    {balances.map((balance) => (
                      <SelectItem key={balance.token} value={balance.token}>
                        {balance.token} (Available: {balance.balance.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount to Stake</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <Label>Staking Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((option) => (
                      <SelectItem key={option.days} value={option.days.toString()}>
                        {option.label} ({option.apy}% APY)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDurationData && amount && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">APY Rate:</span>
                    <span className="font-semibold">{selectedDurationData.apy}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-semibold">{selectedDurationData.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Rewards:</span>
                    <span className="font-semibold text-success">
                      +{estimatedRewards.toFixed(4)} {selectedToken}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleStake}
                disabled={processing || !selectedToken || !amount || !duration}
                className="w-full"
              >
                <Lock className="w-4 h-4 mr-2" />
                {processing ? "Processing..." : "Stake Now"}
              </Button>
            </div>
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
                            <span className="font-semibold text-success">
                              +{stake.rewards_earned.toFixed(4)} {stake.token}
                            </span>
                          </div>
                        )}
                      </div>

                      {isActive && (
                        <Button
                          onClick={() => handleWithdraw(stake.id)}
                          disabled={processing}
                          variant={matured ? "default" : "outline"}
                          className="w-full"
                        >
                          <Unlock className="w-4 h-4 mr-2" />
                          {matured ? "Withdraw with Full Rewards" : "Early Withdraw (50% Penalty)"}
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
