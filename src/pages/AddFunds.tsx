import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";

const AddFunds = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data);
  };

  const handleAddFunds = async () => {
    if (!profile || !amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);

    try {
      // Simulate adding funds (in production, integrate with payment gateway)
      const amountNum = parseFloat(amount);

      // Update balance
      const { data: currentBalance } = await supabase
        .from("wallet_balances")
        .select("balance")
        .eq("user_id", profile.id)
        .eq("token", token)
        .single();

      if (currentBalance) {
        const newBalance = Number(currentBalance.balance) + amountNum;
        
        const { error } = await supabase
          .from("wallet_balances")
          .update({ balance: newBalance })
          .eq("user_id", profile.id)
          .eq("token", token);

        if (error) throw error;

        // Create a transaction record
        await supabase
          .from("transactions")
          .insert({
            sender_id: profile.id,
            recipient_id: profile.id,
            sender_wallet: "0x0000000000000000000000000000000000000000", // External source
            recipient_wallet: profile.wallet_address,
            amount: amountNum,
            token: token,
            transaction_type: "external",
            status: "completed",
            transaction_hash: `0x${Math.random().toString(16).slice(2)}`,
          });

        toast.success(`Successfully added ${amountNum} ${token} to your wallet!`);
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add funds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Add Funds</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card className="shadow-finmo-md bg-gradient-to-br from-primary/5 to-success/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Top Up Your Wallet</p>
                <p className="text-sm text-muted-foreground">
                  Add funds to your FinMo wallet using your preferred payment method
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 text-2xl font-semibold"
                  min="0"
                  step="0.01"
                />
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="MATIC">MATIC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(amt.toString())}
                >
                  ${amt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Credit/Debit Card</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="mobile">Mobile Money</SelectItem>
                <SelectItem value="crypto">Crypto Deposit</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment method info */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {paymentMethod === 'card' && 'Instant deposit • 2.9% fee'}
                {paymentMethod === 'bank' && '1-3 business days • No fee'}
                {paymentMethod === 'mobile' && 'Instant deposit • 1.5% fee'}
                {paymentMethod === 'crypto' && 'On-chain transfer • Network fees apply'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {amount && (
          <Card className="shadow-finmo-md">
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">${amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-semibold">
                  {paymentMethod === 'bank' ? '$0.00' : `$${(parseFloat(amount || '0') * 0.029).toFixed(2)}`}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">
                  ${(parseFloat(amount || '0') * (paymentMethod === 'bank' ? 1 : 1.029)).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Funds Button */}
        <Button
          onClick={handleAddFunds}
          disabled={!amount || loading || parseFloat(amount) <= 0}
          className="w-full h-14 text-lg bg-gradient-success hover:opacity-90"
        >
          {loading ? "Processing..." : `Add ${amount || '0'} ${token}`}
        </Button>
      </div>

      <MobileNav />
    </div>
  );
};

export default AddFunds;
