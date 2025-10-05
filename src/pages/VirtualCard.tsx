import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Eye, EyeOff, Plus, Pause, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileNav from "@/components/MobileNav";

interface VirtualCard {
  id: string;
  card_holder_name: string;
  expiry_month: number;
  expiry_year: number;
  balance: number;
  spending_limit: number;
  is_active: boolean;
  is_frozen: boolean;
  card_number_encrypted: string;
}

const VirtualCard = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCardDetails, setShowCardDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("virtual_cards")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Error fetching cards:", error);
      toast.error("Failed to load virtual cards");
    } finally {
      setLoading(false);
    }
  };

  const toggleCardFreeze = async (cardId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("virtual_cards")
        .update({ is_frozen: !currentState })
        .eq("id", cardId);

      if (error) throw error;
      toast.success(currentState ? "Card unfrozen" : "Card frozen");
      fetchCards();
    } catch (error) {
      console.error("Error toggling card:", error);
      toast.error("Failed to update card");
    }
  };

  const maskCardNumber = (encrypted: string) => {
    return "**** **** **** " + encrypted.slice(-4);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Virtual Cards</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/virtual-card/create")}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading cards...</p>
        ) : cards.length === 0 ? (
          <div className="text-center space-y-4 py-12">
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No virtual cards yet</p>
            <Button onClick={() => navigate("/virtual-card/create")}>
              Create Your First Card
            </Button>
          </div>
        ) : (
          cards.map((card) => (
            <Card key={card.id} className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary to-primary/60 p-6 text-white">
                <div className="flex justify-between items-start mb-8">
                  <CreditCard className="h-8 w-8" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setShowCardDetails(
                      showCardDetails === card.id ? null : card.id
                    )}
                  >
                    {showCardDetails === card.id ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                <div className="space-y-4">
                  <p className="text-lg font-mono tracking-wider">
                    {maskCardNumber(card.card_number_encrypted)}
                  </p>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-70">CARD HOLDER</p>
                      <p className="font-semibold">{card.card_holder_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-70">EXPIRES</p>
                      <p className="font-semibold">
                        {String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-2xl font-bold">${card.balance.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Spending Limit</p>
                    <p className="text-lg font-semibold">${card.spending_limit.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => toggleCardFreeze(card.id, card.is_frozen)}
                  >
                    {card.is_frozen ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Unfreeze
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Freeze
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/virtual-card/${card.id}/transactions`)}
                  >
                    View Transactions
                  </Button>
                </div>

                <Button className="w-full" onClick={() => navigate(`/virtual-card/${card.id}/fund`)}>
                  Load Card
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default VirtualCard;
