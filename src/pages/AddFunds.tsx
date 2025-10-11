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
      .maybeSingle();

    setProfile(data);
  };

  const handleAddFunds = async () => {
    if (!profile || !amount || parseFloat(amount) <= 0) {
      toast.error("Please enter an amount greater than zero.");
      return;
    }

    if (paymentMethod !== 'crypto') {
      toast.error("Please deposit crypto to your wallet address first, then enter your transaction hash here.");
      return;
    }

    setLoading(true);

    try {
      // For crypto deposits, user needs to provide transaction hash
      const txHash = prompt("Please enter the transaction hash of your deposit:");
      
      if (!txHash || !txHash.startsWith('0x')) {
        toast.error("Please enter a valid transaction hash (0x followed by letters and numbers).");
        setLoading(false);
        return;
      }

      const amountNum = parseFloat(amount);

      // First verify the transaction
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-deposit', {
        body: {
          transaction_hash: txHash,
          expected_amount: amountNum,
          token: token
        }
      });

      if (verifyError || !verifyData?.verified) {
        throw new Error(verifyData?.error || 'Transaction verification failed');
      }

      // Call blockchain deposit edge function
      const { data, error } = await supabase.functions.invoke('blockchain-deposit', {
        body: {
          token: token,
          amount: amountNum,
          transaction_hash: txHash
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`Successfully deposited ${amountNum} ${token}!`);
      toast.info("View on explorer", {
        action: {
          label: "Open",
          onClick: () => window.open(data.explorer_url, '_blank')
        }
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error("We couldn't process your deposit. Please check your transaction hash and try again.");
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
                {paymentMethod === 'crypto' && 'On-chain transfer • Network fees apply • Requires transaction hash'}
                {paymentMethod !== 'crypto' && 'Coming soon - Only crypto deposits supported currently'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        {amount && paymentMethod === 'crypto' && (
          <Card className="shadow-finmo-md">
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{amount} {token}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-semibold text-muted-foreground">Paid separately</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Send {token} to your wallet address on Polygon Mumbai testnet, then enter the transaction hash when prompted.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit Instructions */}
        {paymentMethod === 'crypto' && profile && (
          <Card className="shadow-finmo-md bg-primary/5">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">How to Deposit</h3>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li>1. Send {token} to your wallet address</li>
                <li>2. Your address: <code className="text-xs bg-muted px-1 py-0.5 rounded">{profile.wallet_address}</code></li>
                <li>3. Network: Polygon Mumbai Testnet</li>
                <li>4. Click "Deposit" below</li>
                <li>5. Enter the transaction hash when prompted</li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Deposit Button */}
        <Button
          onClick={handleAddFunds}
          disabled={!amount || loading || parseFloat(amount) <= 0 || paymentMethod !== 'crypto'}
          className="w-full h-14 text-lg bg-gradient-success hover:opacity-90"
        >
          {loading ? "Processing..." : `Deposit ${amount || '0'} ${token}`}
        </Button>
      </div>

      <MobileNav />
    </div>
  );
};

export default AddFunds;
