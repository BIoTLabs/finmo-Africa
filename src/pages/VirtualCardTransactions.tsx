import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Filter } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

interface CardTransaction {
  id: string;
  amount: number;
  merchant_name: string | null;
  merchant_category: string | null;
  transaction_type: string;
  currency: string;
  status: string;
  created_at: string;
}

const VirtualCardTransactions = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<any>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'debit' | 'credit'>('all');

  useEffect(() => {
    fetchCardAndTransactions();
  }, [cardId]);

  const fetchCardAndTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch card details
      const { data: cardData, error: cardError } = await supabase
        .from("virtual_cards")
        .select("*")
        .eq("id", cardId)
        .eq("user_id", user.id)
        .single();

      if (cardError) throw cardError;
      setCard(cardData);

      // Fetch card transactions
      const { data: txData, error: txError } = await supabase
        .from("card_transactions")
        .select("*")
        .eq("card_id", cardId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (txError) throw txError;
      setTransactions(txData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.transaction_type === filter;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!card) {
    return <div className="min-h-screen flex items-center justify-center">Card not found</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Card Transactions</h1>
            <p className="text-sm text-muted-foreground">
              {card.card_holder_name} •••• {card.card_number_encrypted.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Card Summary */}
      <div className="p-4">
        <Card className="bg-gradient-to-br from-primary to-primary/60 text-white">
          <CardContent className="p-6">
            <p className="text-sm opacity-80 mb-1">Available Balance</p>
            <p className="text-3xl font-bold">${card.balance.toFixed(2)}</p>
            <p className="text-sm opacity-80 mt-2">
              Spending Limit: ${card.spending_limit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'debit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('debit')}
          >
            Debit
          </Button>
          <Button
            variant={filter === 'credit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('credit')}
          >
            Credit
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4 space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your card transactions will appear here
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <Card key={tx.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.transaction_type === 'credit' 
                        ? 'bg-success/10' 
                        : 'bg-destructive/10'
                    }`}>
                      {tx.transaction_type === 'credit' ? (
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {tx.merchant_name || (tx.transaction_type === 'credit' ? 'Card Load' : 'Purchase')}
                      </p>
                      {tx.merchant_category && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {tx.merchant_category}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      tx.transaction_type === 'credit' ? 'text-success' : 'text-foreground'
                    }`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </p>
                    <Badge 
                      variant={tx.status === 'completed' ? 'default' : 'secondary'}
                      className="mt-1 text-xs"
                    >
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default VirtualCardTransactions;
