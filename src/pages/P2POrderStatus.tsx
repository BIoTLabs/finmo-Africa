import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Timer, Copy } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

const P2POrderStatus = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
    fetchOrder();
    
    // Set up real-time subscription for order updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'p2p_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.expires_at) {
      const updateTimer = () => {
        const now = new Date();
        const expiresAt = new Date(order.expires_at);
        const diff = Math.max(0, expiresAt.getTime() - now.getTime());
        setTimeRemaining(diff);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [order]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from("p2p_orders")
        .select(`
          *,
          listing:p2p_listings(*),
          payment_method:payment_methods(*)
        `)
        .eq("id", orderId)
        .maybeSingle();
      
      if (!data) {
        toast.error("Order not found");
        navigate("/p2p");
        return;
      }

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      const { error } = await supabase
        .from("p2p_orders")
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;
      toast.success("Order marked as paid! Waiting for seller confirmation.");
      fetchOrder();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Failed to update order");
    }
  };

  const handleCompleteOrder = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('complete-p2p-order', {
        body: { order_id: orderId }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Order completed! Crypto has been released.");
      fetchOrder();
    } catch (error: any) {
      console.error("Error completing order:", error);
      toast.error(error.message || "Failed to complete order");
    }
  };

  const copyPaymentDetails = () => {
    if (order?.payment_method) {
      const details = `${order.payment_method.bank_name || order.payment_method.method_type}\nAccount: ${order.payment_method.account_number}\nName: ${order.payment_method.account_name}`;
      navigator.clipboard.writeText(details);
      toast.success("Payment details copied!");
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (order?.status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning">Pending Payment</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary">Payment Confirmed</Badge>;
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'disputed':
        return <Badge variant="destructive">Disputed</Badge>;
      default:
        return null;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center">Order not found</div>;

  const isBuyer = order.buyer_id === currentUser?.id;
  const isSeller = order.seller_id === currentUser?.id;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Order Status</h1>
            <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Timer Card */}
        {order.status === 'pending' && timeRemaining > 0 && (
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-semibold text-warning">Time Remaining</p>
                  <p className="text-sm text-muted-foreground">Complete payment before order expires</p>
                </div>
                <p className="text-2xl font-bold text-warning">{formatTime(timeRemaining)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{order.fiat_amount} {order.currency_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Crypto</span>
              <span className="font-semibold">{order.crypto_amount} {order.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-semibold">{order.rate} {order.currency_code}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        {isBuyer && order.payment_method && order.status === 'pending' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={copyPaymentDetails}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Bank/Method</span>
                  <span className="font-semibold">{order.payment_method.bank_name || order.payment_method.method_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Number</span>
                  <span className="font-mono">{order.payment_method.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Name</span>
                  <span>{order.payment_method.account_name}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <p className="text-sm">
                  Send exactly <strong>{order.fiat_amount} {order.currency_code}</strong> to the account above, then mark as paid.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Messages */}
        {order.status === 'paid' && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-primary">Payment Confirmed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isBuyer && "Waiting for seller to release crypto..."}
                    {isSeller && "Buyer has marked payment as sent. Please confirm receipt and release crypto."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {order.status === 'completed' && (
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <p className="font-semibold text-success">Order Completed!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isBuyer && `${order.crypto_amount} ${order.token} has been added to your wallet.`}
                    {isSeller && `Payment received and crypto released successfully.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {isBuyer && order.status === 'pending' && (
          <Button onClick={handleMarkAsPaid} className="w-full" size="lg">
            I Have Sent Payment
          </Button>
        )}

        {isSeller && order.status === 'paid' && (
          <Button onClick={handleCompleteOrder} className="w-full" size="lg">
            Confirm & Release Crypto
          </Button>
        )}

        {(order.status === 'completed' || order.status === 'cancelled') && (
          <Button onClick={() => navigate('/p2p')} className="w-full" variant="outline">
            Back to P2P Marketplace
          </Button>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default P2POrderStatus;
