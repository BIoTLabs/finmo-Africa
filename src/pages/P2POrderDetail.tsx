import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

const P2POrderDetail = () => {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchListing();
    fetchPaymentMethods();
  }, [listingId]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from("p2p_listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (error) throw error;
      setListing(data);
    } catch (error) {
      console.error("Error fetching listing:", error);
      toast.error("Failed to load listing");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  };

  const handleCreateOrder = async () => {
    if (!amount || parseFloat(amount) < listing.min_amount || parseFloat(amount) > listing.max_amount) {
      toast.error(`Amount must be between ${listing.min_amount} and ${listing.max_amount}`);
      return;
    }

    if (paymentMethods.length === 0) {
      toast.error("Please add a payment method first");
      navigate("/payment-methods");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-p2p-order', {
        body: {
          listing_id: listingId,
          fiat_amount: parseFloat(amount),
          payment_method_id: paymentMethod,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Order created successfully!");
      navigate(`/p2p/order-status/${data.order_id}`);
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  if (!listing) return null;

  const cryptoAmount = (parseFloat(amount || "0") / listing.rate).toFixed(6);
  const isBuying = listing.listing_type === "sell"; // User buys when seller is selling

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">
            {isBuying ? "Buy" : "Sell"} {listing.token}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-semibold">{listing.rate} {listing.currency_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-semibold">{listing.available_amount} {listing.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Limits</span>
              <span className="font-semibold">
                {listing.min_amount} - {listing.max_amount} {listing.currency_code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Payment time limit: {listing.payment_time_limit} minutes</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enter Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Amount ({listing.currency_code})</Label>
              <Input
                type="number"
                placeholder={`${listing.min_amount} - ${listing.max_amount}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={listing.min_amount}
                max={listing.max_amount}
              />
            </div>

            {amount && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">You will {isBuying ? 'receive' : 'send'}</p>
                <p className="text-2xl font-bold">{cryptoAmount} {listing.token}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              {paymentMethods.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="text-sm">
                    No payment methods added.{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-primary"
                      onClick={() => navigate("/payment-methods")}
                    >
                      Add one now
                    </Button>
                  </p>
                </div>
              ) : (
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.bank_name || method.method_type} - {method.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleCreateOrder}
              disabled={!amount || !paymentMethod || loading}
              className="w-full"
            >
              {loading ? "Creating Order..." : `${isBuying ? 'Buy' : 'Sell'} ${listing.token}`}
            </Button>
          </CardContent>
        </Card>

        {listing.terms && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {listing.terms}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default P2POrderDetail;
