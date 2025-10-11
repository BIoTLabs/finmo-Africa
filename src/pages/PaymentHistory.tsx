import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, Clock, XCircle, Send, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

interface PaymentRequest {
  id: string;
  amount: number;
  token: string;
  message?: string;
  status: string;
  recipient_email: string;
  recipient_name?: string;
  requester_id: string;
  payer_id?: string;
  expires_at: string;
  created_at: string;
  paid_at?: string;
}

const PaymentHistory = () => {
  const navigate = useNavigate();
  const [sentRequests, setSentRequests] = useState<PaymentRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPaymentRequests();
    }
  }, [user]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchPaymentRequests = async () => {
    try {
      // Fetch sent requests
      const { data: sent, error: sentError } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });

      if (sentError) throw sentError;
      setSentRequests(sent || []);

      // Fetch received requests (where user is the payer)
      const { data: received, error: receivedError } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("payer_id", user.id)
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;
      setReceivedRequests(received || []);

    } catch (error) {
      console.error("Error fetching payment requests:", error);
      toast.error("We couldn't load your payment history. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (request: PaymentRequest) => {
    const isExpired = new Date(request.expires_at) < new Date();
    
    if (request.status === "paid") {
      return (
        <Badge className="bg-success text-success-foreground">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    } else if (isExpired) {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-warning text-warning-foreground">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const copyPaymentLink = (id: string) => {
    const link = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(link);
    toast.success("Payment link copied to clipboard!");
  };

  const resendRequest = async (request: PaymentRequest) => {
    try {
      if (!request.recipient_email) {
        toast.error("We couldn't find an email address for this payment request.");
        return;
      }

      // Only send email if recipient_email is a valid email
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.recipient_email);
      
      if (isEmail) {
        const { error: emailError } = await supabase.functions.invoke('send-payment-request', {
          body: {
            payment_request_id: request.id,
            recipient_email: request.recipient_email,
            requester_name: request.recipient_name || "Someone",
            amount: request.amount,
            token: request.token,
          }
        });

        if (emailError) {
          console.error("Email error:", emailError);
          toast.error("We couldn't send the email. Please try again later.");
        } else {
          toast.success("Email sent successfully!");
        }
      } else {
        // It's a phone number, send SMS
        const { error: smsError } = await supabase.functions.invoke('send-payment-request-sms', {
          body: {
            payment_request_id: request.id,
            recipient_phone: request.recipient_email,
            requester_name: request.recipient_name || "Someone",
            amount: request.amount,
            token: request.token,
          }
        });

        if (smsError) {
          console.error("SMS error:", smsError);
          toast.error("We couldn't send the SMS. Please try again later.");
        } else {
          toast.success("SMS sent successfully!");
        }
      }
    } catch (error) {
      console.error("Error resending request:", error);
      toast.error("We couldn't resend the payment request. Please try again.");
    }
  };

  const renderRequestCard = (request: PaymentRequest, isSent: boolean) => (
    <Card key={request.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <p className="font-semibold text-lg">
              ${request.amount} {request.token}
            </p>
            <p className="text-sm text-muted-foreground">
              {isSent ? `To: ${request.recipient_email}` : `Request ID: ${request.id.slice(0, 8)}...`}
            </p>
            {request.message && (
              <p className="text-sm text-muted-foreground mt-1 italic">
                "{request.message}"
              </p>
            )}
          </div>
          {getStatusBadge(request)}
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Created: {new Date(request.created_at).toLocaleDateString()}</p>
          {request.paid_at && (
            <p>Paid: {new Date(request.paid_at).toLocaleDateString()}</p>
          )}
          <p>Expires: {new Date(request.expires_at).toLocaleDateString()}</p>
        </div>

        {isSent && request.status === "pending" && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => copyPaymentLink(request.id)}
            >
              Copy Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => resendRequest(request)}
            >
              Resend
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p className="text-muted-foreground">Loading payment history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 w-9 h-9"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Payment History</h1>
        </div>
        <p className="text-sm opacity-90">Track your payment requests</p>
      </div>

      <div className="p-4">
        <Tabs defaultValue="sent" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="sent">
              <Send className="w-4 h-4 mr-2" />
              Sent ({sentRequests.length})
            </TabsTrigger>
            <TabsTrigger value="received">
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Received ({receivedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent">
            {sentRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No payment requests sent yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => navigate("/request-payment")}
                  >
                    Send Payment Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              sentRequests.map(request => renderRequestCard(request, true))
            )}
          </TabsContent>

          <TabsContent value="received">
            {receivedRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ArrowDownToLine className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No payment requests received yet</p>
                </CardContent>
              </Card>
            ) : (
              receivedRequests.map(request => renderRequestCard(request, false))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <MobileNav />
    </div>
  );
};

export default PaymentHistory;
