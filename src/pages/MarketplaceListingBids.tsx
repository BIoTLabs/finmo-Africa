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
import { ArrowLeft, MessageCircle, Phone, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  seller_id: string;
}

interface Bid {
  id: string;
  bidder_id: string;
  bid_amount: number;
  currency: string;
  message: string;
  phone_number: string;
  status: string;
  created_at: string;
}

const MarketplaceListingBids = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState({
    bid_amount: "",
    message: "",
    phone_number: "",
  });

  useEffect(() => {
    if (id) {
      fetchListing();
      fetchBids();
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
      toast.error("Failed to load listing");
      console.error(error);
      navigate("/marketplace");
    } else {
      setListing(data);
    }
    setLoading(false);
  };

  const fetchBids = async () => {
    const { data, error } = await supabase
      .from("marketplace_bids")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bids:", error);
    } else {
      setBids(data || []);
    }
  };

  const handleSubmitBid = async () => {
    if (!listing) return;

    const amount = parseFloat(formData.bid_amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount");
      return;
    }

    if (!formData.phone_number) {
      toast.error("Please provide your phone number");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to place a bid");
        return;
      }

      const { error } = await supabase.from("marketplace_bids").insert({
        listing_id: listing.id,
        bidder_id: user.id,
        seller_id: listing.seller_id,
        bid_amount: amount,
        currency: listing.currency,
        message: formData.message,
        phone_number: formData.phone_number,
      });

      if (error) throw error;

      toast.success("Bid submitted successfully!");
      setFormData({ bid_amount: "", message: "", phone_number: "" });
      fetchBids();
    } catch (error: any) {
      console.error("Error submitting bid:", error);
      toast.error(error.message || "Failed to submit bid");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    try {
      const { error } = await supabase
        .from("marketplace_bids")
        .update({ status: "accepted" })
        .eq("id", bidId);

      if (error) throw error;

      toast.success("Bid accepted!");
      fetchBids();
    } catch (error: any) {
      console.error("Error accepting bid:", error);
      toast.error(error.message || "Failed to accept bid");
    }
  };

  const handleRejectBid = async (bidId: string) => {
    try {
      const { error } = await supabase
        .from("marketplace_bids")
        .update({ status: "rejected" })
        .eq("id", bidId);

      if (error) throw error;

      toast.success("Bid rejected");
      fetchBids();
    } catch (error: any) {
      console.error("Error rejecting bid:", error);
      toast.error(error.message || "Failed to reject bid");
    }
  };

  if (loading || !listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
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
          <h1 className="text-xl font-bold">Listing & Bids</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Image Gallery */}
        {listing.images && listing.images.length > 0 && (
          <div className="space-y-2">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              <img
                src={listing.images[currentImageIndex]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            </div>
            {listing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {listing.images.map((image, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      currentImageIndex === idx ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={image} alt={`${listing.title} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Listing Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <p className="text-3xl font-bold text-primary">
              Starting: {listing.price} {listing.currency}
            </p>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </CardContent>
        </Card>

        {/* Place Bid */}
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <DollarSign className="w-4 h-4 mr-2" />
              Place a Bid
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Your Bid</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bid_amount">Your Bid Amount *</Label>
                <Input
                  id="bid_amount"
                  type="number"
                  step="0.01"
                  placeholder={`Min: ${listing.price}`}
                  value={formData.bid_amount}
                  onChange={(e) => setFormData({ ...formData, bid_amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Your Phone Number *</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+234..."
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Explain your offer..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                />
              </div>

              <Button onClick={handleSubmitBid} disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit Bid"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bids List */}
        <Card>
          <CardHeader>
            <CardTitle>All Bids ({bids.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bids.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No bids yet</p>
            ) : (
              bids.map((bid) => (
                <Card key={bid.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {bid.bid_amount} {bid.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(bid.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={bid.status === "accepted" ? "default" : bid.status === "rejected" ? "destructive" : "secondary"}>
                        {bid.status}
                      </Badge>
                    </div>

                    {bid.message && (
                      <div className="flex gap-2 items-start">
                        <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <p className="text-sm">{bid.message}</p>
                      </div>
                    )}

                    {bid.phone_number && (
                      <div className="flex gap-2 items-center">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm">{bid.phone_number}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
};

export default MarketplaceListingBids;
