import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import MobileNav from "@/components/MobileNav";

interface WalletBalance {
  token: string;
  balance: number;
}

const VirtualCardFund = () => {
  const navigate = useNavigate();
  const { cardId } = useParams();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [balances, setBalances] = useState<WalletBalance[]>([]);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setBalances(data || []);
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const handleFundCard = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const selectedBalance = balances.find(b => b.token === token);
    if (!selectedBalance || parseFloat(amount) > selectedBalance.balance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current card balance
      const { data: card, error: cardError } = await supabase
        .from("virtual_cards")
        .select("balance")
        .eq("id", cardId)
        .eq("user_id", user.id)
        .single();

      if (cardError) throw cardError;

      // Update card balance
      const newCardBalance = Number(card.balance) + parseFloat(amount);
      const { error: updateError } = await supabase
        .from("virtual_cards")
        .update({ balance: newCardBalance })
        .eq("id", cardId);

      if (updateError) throw updateError;

      // Deduct from wallet balance
      const newWalletBalance = selectedBalance.balance - parseFloat(amount);
      const { error: balanceError } = await supabase
        .from("wallet_balances")
        .update({ balance: newWalletBalance })
        .eq("user_id", user.id)
        .eq("token", token);

      if (balanceError) throw balanceError;

      // Create transaction record
      await supabase
        .from("card_transactions")
        .insert({
          card_id: cardId,
          user_id: user.id,
          amount: parseFloat(amount),
          currency: "USD",
          transaction_type: "load",
          status: "completed"
        });

      toast.success("Card loaded successfully!");
      navigate("/virtual-card");
    } catch (error: any) {
      console.error("Error funding card:", error);
      toast.error(error.message || "Failed to fund card");
    } finally {
      setLoading(false);
    }
  };

  const selectedBalance = balances.find(b => b.token === token);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Load Card</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Select Token</Label>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {balances.map(balance => (
                    <SelectItem key={balance.token} value={balance.token}>
                      {balance.token} (Available: {balance.balance.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Available: {selectedBalance?.balance.toFixed(2) || "0.00"} {token}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(amt.toString())}
                  disabled={!selectedBalance || amt > selectedBalance.balance}
                >
                  ${amt}
                </Button>
              ))}
            </div>

            <Button 
              className="w-full" 
              onClick={handleFundCard}
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? "Processing..." : `Load $${amount || "0"}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
};

export default VirtualCardFund;
