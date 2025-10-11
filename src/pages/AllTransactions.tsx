import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

interface Transaction {
  id: string;
  amount: number;
  token: string;
  transaction_type: string;
  created_at: string;
  sender_wallet: string;
  recipient_wallet: string;
  sender_id: string;
  recipient_id: string | null;
  status: string;
  transaction_hash: string | null;
}

interface PaymentRequest {
  id: string;
  amount: number;
  token: string;
  status: string;
  created_at: string;
  recipient_email: string;
  recipient_name: string | null;
  requester_id: string;
  payer_id: string | null;
}

type CombinedActivity = {
  id: string;
  type: 'transaction' | 'payment_request';
  amount: number;
  token: string;
  created_at: string;
  status: string;
  data: Transaction | PaymentRequest;
};

const AllTransactions = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<CombinedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAllActivities();
  }, []);

  const loadAllActivities = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Load transactions
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });

      // Load payment requests
      const { data: requests, error: reqError } = await supabase
        .from("payment_requests")
        .select("*")
        .or(`requester_id.eq.${session.user.id},payer_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });

      if (txError) {
        console.error("Error loading transactions:", txError);
      }

      if (reqError) {
        console.error("Error loading payment requests:", reqError);
      }

      // Combine and sort
      const combined: CombinedActivity[] = [
        ...(transactions || []).map(tx => ({
          id: tx.id,
          type: 'transaction' as const,
          amount: tx.amount,
          token: tx.token,
          created_at: tx.created_at,
          status: tx.status,
          data: tx
        })),
        ...(requests || []).map(req => ({
          id: req.id,
          type: 'payment_request' as const,
          amount: req.amount,
          token: req.token,
          created_at: req.created_at,
          status: req.status,
          data: req
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(combined);
    } catch (error) {
      console.error("Error loading activities:", error);
      toast.error("We couldn't load your activity. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const resendRequest = async (request: PaymentRequest) => {
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.recipient_email);
      
      if (isEmail) {
        const { error } = await supabase.functions.invoke('send-payment-request', {
          body: {
            payment_request_id: request.id,
            recipient_email: request.recipient_email,
            requester_name: request.recipient_name || "Someone",
            amount: request.amount,
            token: request.token,
          }
        });

        if (error) throw error;
        toast.success("Email sent successfully!");
      } else {
        const { error } = await supabase.functions.invoke('send-payment-request-sms', {
          body: {
            payment_request_id: request.id,
            recipient_phone: request.recipient_email,
            requester_name: request.recipient_name || "Someone",
            amount: request.amount,
            token: request.token,
          }
        });

        if (error) throw error;
        toast.success("SMS sent successfully!");
      }
    } catch (error) {
      console.error("Error resending:", error);
      toast.error("We couldn't resend this transaction. Please try again.");
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">All Activity</h1>
        </div>
      </div>

      {/* Activities List */}
      <div className="p-6 space-y-4">
        {activities.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No activity yet</p>
              <p className="text-xs mt-2">Your transactions and payment requests will appear here</p>
            </CardContent>
          </Card>
        ) : (
          activities.map((activity) => {
            if (activity.type === 'transaction') {
              const tx = activity.data as Transaction;
              const isReceived = tx.recipient_id === userId;
              const isDeposit = tx.transaction_type === 'deposit';

              return (
                <Card 
                  key={activity.id}
                  className="shadow-finmo-sm hover:shadow-finmo-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/transaction/${activity.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isReceived ? "bg-success/10" : "bg-primary/10"
                      }`}>
                        {isReceived ? (
                          <ArrowDownLeft className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">
                            {isDeposit ? "Deposited" : isReceived ? "Received" : "Sent"}
                          </p>
                          {tx.transaction_type === 'internal' && (
                            <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                              Instant
                            </Badge>
                          )}
                          {isDeposit && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              Blockchain
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isDeposit 
                            ? `From external wallet` 
                            : isReceived 
                              ? `From ${tx.sender_wallet.slice(0, 12)}...` 
                              : `To ${tx.recipient_wallet.slice(0, 12)}...`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(tx.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          isReceived ? "text-success" : "text-foreground"
                        }`}>
                          {isReceived ? "+" : "-"}{Number(tx.amount).toFixed(2)} {tx.token}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            } else {
              const request = activity.data as PaymentRequest;
              const isRequester = request.requester_id === userId;

              return (
                <Card key={activity.id} className="shadow-finmo-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">
                            {isRequester ? "Payment Request Sent" : "Payment Request Received"}
                          </p>
                          <Badge variant={request.status === 'paid' ? 'default' : 'secondary'}>
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isRequester ? `To ${request.recipient_email}` : `From ${request.recipient_name || 'Unknown'}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(request.created_at)}</p>
                      </div>
                      <div className="text-right flex flex-col gap-2">
                        <p className="font-semibold">
                          {Number(request.amount).toFixed(2)} {request.token}
                        </p>
                        {isRequester && request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              resendRequest(request);
                            }}
                            className="h-7 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Resend
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })
        )}
      </div>
    </div>
  );
};

export default AllTransactions;
