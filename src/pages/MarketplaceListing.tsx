import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import MobileNav from "@/components/MobileNav";
import { ArrowLeft, User, ShoppingCart, Gift } from "lucide-react";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  condition: string;
  location: string;
  is_service: boolean;
  seller_id: string;
  listing_type: string;
  created_at: string;
}

const MarketplaceListing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [buyForOther, setBuyForOther] = useState(false);
  const [giftRecipientPhone, setGiftRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryName, setDeliveryName] = useState("");

  useEffect(() => {
    if (id) {
      fetchListing();
    }
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("We couldn't find this listing. It may have been removed.");
      console.error(error);
      navigate("/marketplace");
    } else {
      setListing(data);
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!listing) return;

    setPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to make a purchase.");
        return;
      }

      // Check balance
      const { data: balance } = await supabase
        .from("wallet_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("token", listing.currency)
        .single();

      if (!balance || Number(balance.balance) < listing.price) {
        toast.error("You don't have enough funds. Please add money to your wallet.");
        return;
      }

      let giftedToUserId = null;
      if (buyForOther && giftRecipientPhone) {
        const { data: recipientData } = await supabase.rpc("lookup_user_by_phone", {
          phone: giftRecipientPhone,
        });
        
        if (recipientData && recipientData.length > 0) {
          giftedToUserId = recipientData[0].user_id;
        } else {
          toast.error("We couldn't find a user with that phone number.");
          return;
        }
      }

      // Create order with escrow
      const { data: order, error: orderError } = await supabase
        .from("marketplace_orders")
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          gifted_to_user_id: giftedToUserId,
          amount: listing.price,
          currency: listing.currency,
          status: "pending",
          delivery_address: deliveryAddress,
          delivery_phone: deliveryPhone,
          delivery_name: deliveryName,
          escrow_amount: listing.price,
          escrow_released: false,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Deduct from buyer balance and put into escrow
      const newBuyerBalance = Number(balance.balance) - listing.price;
      await supabase
        .from("wallet_balances")
        .update({ balance: newBuyerBalance })
        .eq("user_id", user.id)
        .eq("token", listing.currency);

      // Create transaction record
      await supabase.from("transactions").insert({
        sender_id: user.id,
        recipient_id: listing.seller_id,
        sender_wallet: "marketplace",
        recipient_wallet: "marketplace",
        amount: listing.price,
        token: listing.currency,
        transaction_type: "marketplace",
        status: "completed",
      });

      // Update order status
      await supabase
        .from("marketplace_orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", order.id);

      // Create notifications
      await supabase.from("marketplace_notifications").insert([
        {
          user_id: listing.seller_id,
          type: "order_paid",
          title: "New Order Received",
          message: `${listing.title} was purchased`,
          order_id: order.id,
          listing_id: listing.id,
        },
        ...(giftedToUserId ? [{
          user_id: giftedToUserId,
          type: "gift_received",
          title: "Gift Received",
          message: `Someone bought ${listing.title} for you!`,
          order_id: order.id,
          listing_id: listing.id,
        }] : []),
      ]);

      toast.success("Purchase successful!");
      navigate("/marketplace/orders");
    } catch (error: any) {
      toast.error("Something went wrong with your purchase. Please try again.");
      console.error(error);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/marketplace")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Listing Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Images */}
        {listing.images && listing.images.length > 0 ? (
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-muted-foreground" />
          </div>
        )}

        {/* Details */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
              <p className="text-3xl font-bold text-primary">
                {listing.price} {listing.currency}
              </p>
            </div>

            {!listing.is_service && listing.condition && (
              <Badge variant="secondary">{listing.condition}</Badge>
            )}

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>

            {listing.location && (
              <div>
                <h3 className="font-semibold mb-1">Location</h3>
                <p className="text-muted-foreground">{listing.location}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar>
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">Seller</span>
            </div>
          </CardContent>
        </Card>

        {/* Purchase/Bid Button */}
        {listing.listing_type === "fixed_price" ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Now
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purchase Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="buy-for-other">Buy for someone else?</Label>
                <Switch
                  id="buy-for-other"
                  checked={buyForOther}
                  onCheckedChange={setBuyForOther}
                />
              </div>

              {buyForOther && (
                <div>
                  <Label htmlFor="recipient-phone">
                    <Gift className="w-4 h-4 inline mr-1" />
                    Recipient Phone Number
                  </Label>
                  <Input
                    id="recipient-phone"
                    value={giftRecipientPhone}
                    onChange={(e) => setGiftRecipientPhone(e.target.value)}
                    placeholder="+234..."
                  />
                </div>
              )}

              <div>
                <Label htmlFor="delivery-name">Delivery Name *</Label>
                <Input
                  id="delivery-name"
                  value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="delivery-phone">Delivery Phone *</Label>
                <Input
                  id="delivery-phone"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="delivery-address">Delivery Address *</Label>
                <Textarea
                  id="delivery-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>

              <Button
                onClick={handlePurchase}
                disabled={purchasing || !deliveryName || !deliveryPhone || !deliveryAddress}
                className="w-full"
              >
                {purchasing ? "Processing..." : `Pay ${listing.price} ${listing.currency}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate(`/marketplace/listing/${listing.id}/bids`)}
          >
            View Bids & Place Offer
          </Button>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default MarketplaceListing;
