import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, User, Mail, ArrowLeft, Home } from "lucide-react";

interface PaymentRequestData {
  id: string;
  amount: number;
  token: string;
  message?: string;
  status: string;
  recipient_email: string;
  recipient_name?: string;
  requester_id: string;
  requester_name?: string;
  expires_at: string;
  created_at: string;
}

const PaymentRequest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchPaymentRequest();
  }, [id]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchPaymentRequest = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch requester profile separately
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("display_name, phone_number")
        .eq("id", data.requester_id)
        .single();

      const requesterName = requesterProfile?.display_name || requesterProfile?.phone_number || "FinMo User";

      setPaymentRequest({
        ...data,
        requester_name: requesterName,
      });
    } catch (error) {
      console.error("Error fetching payment request:", error);
      toast.error("We couldn't find this payment request. The link may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!user) {
      toast.error("Please sign in to complete this payment.");
      navigate("/auth", { state: { returnTo: `/pay/${id}` } });
      return;
    }

    if (!paymentRequest) return;

    setProcessing(true);

    try {
      // Check user balance
      const { data: balance } = await supabase
        .from("wallet_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("token", paymentRequest.token)
        .single();

      if (!balance || Number(balance.balance) < paymentRequest.amount) {
        toast.error("You don't have enough funds. Please add money to your wallet.");
        navigate("/add-funds");
        return;
      }

      // Process internal transfer
      const { error: txError } = await supabase.functions.invoke("process-transaction", {
        body: {
          recipient_wallet: null,
          recipient_phone: null,
          amount: paymentRequest.amount,
          token: paymentRequest.token,
          transaction_type: "internal",
        },
      });

      if (txError) throw txError;

      // Update payment request status
      await supabase
        .from("payment_requests")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payer_id: user.id,
        })
        .eq("id", id);

      toast.success("Payment completed successfully!");
      fetchPaymentRequest();

    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error("Something went wrong with your payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading payment request...</p>
      </div>
    );
  }

  if (!paymentRequest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Request Not Found</h2>
            <p className="text-muted-foreground">
              This payment request may have expired or been cancelled.
            </p>
            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(paymentRequest.expires_at) < new Date();
  const isPaid = paymentRequest.status === "paid";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                  {paymentRequest.requester_name?.[0] || "F"}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">Payment Request</CardTitle>
            <CardDescription>from {paymentRequest.requester_name}</CardDescription>
          </CardHeader>

        <CardContent className="space-y-6">
          {/* Amount */}
          <div className="text-center py-6 bg-gradient-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Amount Requested</p>
            <p className="text-4xl font-bold text-primary">
              ${paymentRequest.amount} {paymentRequest.token}
            </p>
          </div>

          {/* Message */}
          {paymentRequest.message && (
            <div className="bg-muted p-4 rounded-lg border-l-4 border-primary">
              <p className="text-sm font-semibold mb-1">Message</p>
              <p className="text-sm text-muted-foreground">{paymentRequest.message}</p>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2">
            {isPaid ? (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle className="w-4 h-4 mr-1" />
                Paid
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive">
                <Clock className="w-4 h-4 mr-1" />
                Expired
              </Badge>
            ) : (
              <Badge className="bg-warning text-warning-foreground">
                <Clock className="w-4 h-4 mr-1" />
                Pending
              </Badge>
            )}
          </div>

          {/* Action Button */}
          {!isPaid && !isExpired && (
            <Button
              onClick={handlePay}
              disabled={processing}
              className="w-full bg-gradient-primary hover:opacity-90 h-12"
            >
              {processing ? "Processing..." : `Pay $${paymentRequest.amount} ${paymentRequest.token}`}
            </Button>
          )}

          {!user && !isPaid && !isExpired && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have an account?
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/auth", { state: { returnTo: `/pay/${id}` } })}
                className="w-full"
              >
                Sign Up to Pay
              </Button>
            </div>
          )}

          {/* Details */}
          <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>To: {paymentRequest.recipient_email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Expires: {new Date(paymentRequest.expires_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default PaymentRequest;
