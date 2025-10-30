import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import MobileNav from "@/components/MobileNav";
import DisputeDialog from "@/components/DisputeDialog";
import RatingDialog from "@/components/RatingDialog";
import OrderChat from "@/components/OrderChat";
import { ArrowLeft, Truck, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status: string;
  delivery_address: string;
  delivery_phone: string;
  delivery_name: string;
  created_at: string;
  escrow_amount?: number;
  escrow_released?: boolean;
  rider_amount?: number;
  seller_amount?: number;
  buyer_confirmed_delivery?: boolean;
  buyer_confirmation_date?: string;
  marketplace_listings: {
    title: string;
    description: string;
    images: string[];
  };
}

interface DeliveryBid {
  id: string;
  rider_id: string;
  bid_amount: number;
  currency: string;
  estimated_delivery_time: number;
  message: string;
  status: string;
  created_at: string;
}

const MarketplaceOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [bids, setBids] = useState<DeliveryBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
      fetchDeliveryBids();
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select(`
        *,
        marketplace_listings (
          title,
          description,
          images
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("We couldn't load this order. Please try again.");
      console.error(error);
      navigate("/marketplace/orders");
    } else {
      setOrder(data);
    }
    setLoading(false);
  };

  const fetchDeliveryBids = async () => {
    const { data, error } = await supabase
      .from("marketplace_delivery_bids")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setBids(data || []);
    }
  };

  const handleSubmitBid = async () => {
    if (!order) return;

    setSubmittingBid(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to submit a delivery bid.");
        return;
      }

      const { error } = await supabase.from("marketplace_delivery_bids").insert({
        order_id: order.id,
        rider_id: user.id,
        bid_amount: parseFloat(bidAmount),
        currency: order.currency,
        estimated_delivery_time: parseInt(estimatedTime),
        message: bidMessage,
        status: "pending",
      });

      if (error) throw error;

      // Create notification for buyer
      await supabase.from("marketplace_notifications").insert({
        user_id: order.buyer_id,
        type: "bid_received",
        title: "New Delivery Bid",
        message: `A delivery bid of ${bidAmount} ${order.currency} was received`,
        order_id: order.id,
      });

      toast.success("Bid submitted successfully!");
      setBidAmount("");
      setEstimatedTime("");
      setBidMessage("");
      fetchDeliveryBids();
    } catch (error: any) {
      toast.error("We couldn't submit your delivery bid. Please try again.");
      console.error(error);
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    const { error } = await supabase
      .from("marketplace_delivery_bids")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", bidId);

    if (error) {
      toast.error("We couldn't accept this delivery bid. Please try again.");
      console.error(error);
    } else {
      // Update order status
      await supabase
        .from("marketplace_orders")
        .update({ status: "shipped" })
        .eq("id", order?.id);

      toast.success("Bid accepted! Order marked as shipped");
      fetchOrderDetails();
      fetchDeliveryBids();
    }
  };

  const handleConfirmDelivery = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-release-escrow', {
        body: { order_id: order?.id },
      });

      if (error) throw error;

      toast.success(data.message || 'Delivery confirmed! Payment released.');
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Error confirming delivery:', error);
      toast.error("We couldn't confirm delivery. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!order) return null;

  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUser(user.id);
    };
    getCurrentUser();
  }, []);

  const isBuyer = currentUser === order.buyer_id;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/marketplace/orders")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Order Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{order.marketplace_listings?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-bold text-primary">
                {order.amount} {order.currency}
              </p>
              <Badge className="mt-2">{order.status}</Badge>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Delivery Details</h3>
              <p className="text-sm"><strong>Name:</strong> {order.delivery_name}</p>
              <p className="text-sm"><strong>Phone:</strong> {order.delivery_phone}</p>
              <p className="text-sm"><strong>Address:</strong> {order.delivery_address}</p>
            </div>

            {/* Confirm Delivery Button for Buyer */}
            {isBuyer && order.status === "shipped" && !order.buyer_confirmed_delivery && (
              <Button
                onClick={handleConfirmDelivery}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Confirming..." : "Confirm Delivery"}
              </Button>
            )}

            {order.buyer_confirmed_delivery && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Delivery confirmed. Payment released to seller{order.rider_amount && order.rider_amount > 0 ? " and rider" : ""}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Bids Section */}
        {order.status === "paid" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Bids ({bids.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bids.map((bid) => (
                <div key={bid.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">
                        {bid.bid_amount} {bid.currency}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Est. {bid.estimated_delivery_time} mins
                      </p>
                    </div>
                    <Badge>{bid.status}</Badge>
                  </div>
                  {bid.message && (
                    <p className="text-sm text-muted-foreground mb-2">{bid.message}</p>
                  )}
                  {isBuyer && bid.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptBid(bid.id)}
                      className="w-full"
                    >
                      Accept Bid
                    </Button>
                  )}
                </div>
              ))}

              {/* Bid Form for Riders */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Place Delivery Bid
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit Delivery Bid</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="bid-amount">Bid Amount ({order.currency}) *</Label>
                      <Input
                        id="bid-amount"
                        type="number"
                        step="0.01"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="estimated-time">Estimated Time (minutes) *</Label>
                      <Input
                        id="estimated-time"
                        type="number"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="bid-message">Message</Label>
                      <Textarea
                        id="bid-message"
                        value={bidMessage}
                        onChange={(e) => setBidMessage(e.target.value)}
                        placeholder="Add any additional details..."
                      />
                    </div>

                    <Button
                      onClick={handleSubmitBid}
                      disabled={submittingBid || !bidAmount || !estimatedTime}
                      className="w-full"
                    >
                      {submittingBid ? "Submitting..." : "Submit Bid"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Chat and Dispute for Active Orders */}
        {order.status !== "delivered" && order.status !== "cancelled" && (
          <>
            <OrderChat orderId={order.id} orderType="marketplace" />
            <DisputeDialog orderId={order.id} orderType="marketplace_order" />
          </>
        )}

        {/* Rating after delivery */}
        {order.buyer_confirmed_delivery && (
          <>
            <Button 
              onClick={() => setShowRatingDialog(true)} 
              className="w-full" 
              variant="outline"
            >
              Rate Seller
            </Button>
            <RatingDialog
              open={showRatingDialog}
              onOpenChange={setShowRatingDialog}
              orderId={order.id}
              orderType="marketplace"
              ratedUserId={order.seller_id}
            />
          </>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default MarketplaceOrderDetail;
