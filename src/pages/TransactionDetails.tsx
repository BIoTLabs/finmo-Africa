import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, CheckCircle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";
import { blockchainService } from "@/utils/blockchain";

const TransactionDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    setUserProfile(profile);

    // Load transaction
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Transaction not found");
      navigate("/dashboard");
    } else {
      setTransaction(data);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-warning" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  if (loading || !transaction || !userProfile) {
    return <div className="min-h-screen bg-muted flex items-center justify-center">Loading...</div>;
  }

  const isSender = transaction.sender_id === userProfile.id;
  const isInternal = transaction.transaction_type === 'internal';

  return (
    <div className="min-h-screen bg-muted pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Transaction Details</h1>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getStatusIcon(transaction.status)}
              <span className="text-2xl font-bold capitalize">{transaction.status}</span>
            </div>
            <p className={`text-4xl font-bold mb-2 ${isSender ? 'text-white' : 'text-success'}`}>
              {isSender ? '-' : '+'}{Number(transaction.amount).toFixed(2)} {transaction.token}
            </p>
            <p className="text-sm opacity-90">
              {isSender ? 'Sent' : 'Received'} • {new Date(transaction.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-4">
        {/* Transaction Info */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge className={isInternal ? "bg-success" : "bg-primary"}>
                {isInternal ? "Instant (FinMo)" : "On-Chain"}
              </Badge>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span className="text-muted-foreground">From</span>
              <code className="text-xs font-mono">
                {transaction.sender_wallet.slice(0, 6)}...{transaction.sender_wallet.slice(-4)}
              </code>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <code className="text-xs font-mono">
                {transaction.recipient_wallet.slice(0, 6)}...{transaction.recipient_wallet.slice(-4)}
              </code>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{Number(transaction.amount).toFixed(2)} {transaction.token}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="font-semibold">{isInternal ? '$0.00' : '~$0.02'}</span>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="text-sm">{new Date(transaction.created_at).toLocaleString()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <code className="text-xs font-mono">
                {transaction.id.slice(0, 8)}...
              </code>
            </div>

            {transaction.transaction_hash && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-muted-foreground text-sm">Transaction Hash</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                      {transaction.transaction_hash}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(blockchainService.getExplorerUrl(transaction.transaction_hash), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Explorer
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/send")}
          >
            Send Again
          </Button>
          <Button
            className="flex-1 bg-gradient-primary"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      <MobileNav />
    </div>
  );
};

export default TransactionDetails;
