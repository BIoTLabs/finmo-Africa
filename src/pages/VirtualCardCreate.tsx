import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileNav from "@/components/MobileNav";

const VirtualCardCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cardHolderName, setCardHolderName] = useState("");
  const [spendingLimit, setSpendingLimit] = useState("1000");

  const generateCardNumber = () => {
    // Generate a random 16-digit card number (for demo - in production use proper card provider)
    const parts = [];
    for (let i = 0; i < 4; i++) {
      parts.push(Math.floor(1000 + Math.random() * 9000).toString());
    }
    return parts.join("");
  };

  const generateCVV = () => {
    return Math.floor(100 + Math.random() * 900).toString();
  };

  const handleCreateCard = async () => {
    if (!cardHolderName.trim()) {
      toast.error("Please enter cardholder name");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const currentDate = new Date();
      const expiryMonth = currentDate.getMonth() + 1;
      const expiryYear = currentDate.getFullYear() + 3;

      const { error } = await supabase
        .from("virtual_cards")
        .insert({
          user_id: user.id,
          card_number_encrypted: generateCardNumber(),
          card_holder_name: cardHolderName.toUpperCase(),
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          cvv_encrypted: generateCVV(),
          balance: 0,
          spending_limit: parseFloat(spendingLimit),
          currency: "USD",
          is_active: true,
          is_frozen: false
        });

      if (error) throw error;

      toast.success("Virtual card created successfully!");
      navigate("/virtual-card");
    } catch (error: any) {
      console.error("Error creating card:", error);
      toast.error(error.message || "Failed to create card");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Create Virtual Card</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Card className="bg-gradient-to-br from-primary to-primary/60 p-6 text-white">
          <div className="space-y-4">
            <p className="text-sm opacity-90">Preview</p>
            <div className="space-y-6">
              <p className="text-lg font-mono tracking-wider">
                •••• •••• •••• ••••
              </p>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-70">CARD HOLDER</p>
                  <p className="font-semibold">
                    {cardHolderName.toUpperCase() || "YOUR NAME"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">EXPIRES</p>
                  <p className="font-semibold">
                    {String(new Date().getMonth() + 1).padStart(2, '0')}/{new Date().getFullYear() + 3}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Cardholder Name</Label>
              <Input
                placeholder="JOHN DOE"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value)}
                className="uppercase"
              />
            </div>

            <div>
              <Label>Monthly Spending Limit (USD)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
                min="100"
                step="100"
              />
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-semibold">Features:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instant card creation</li>
                <li>• Fund with USDC/USDT</li>
                <li>• Global online payments</li>
                <li>• Freeze/unfreeze anytime</li>
              </ul>
            </div>

            <Button 
              className="w-full" 
              onClick={handleCreateCard}
              disabled={loading || !cardHolderName.trim()}
            >
              {loading ? "Creating..." : "Create Card"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
};

export default VirtualCardCreate;
