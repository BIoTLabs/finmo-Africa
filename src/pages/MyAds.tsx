import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Store, ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MyAds() {
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [p2pListings, setP2pListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch marketplace listings
      const { data: marketplace } = await supabase
        .from("marketplace_listings")
        .select("*, marketplace_orders(id, status)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch P2P listings
      const { data: p2p } = await supabase
        .from("p2p_listings")
        .select("*, p2p_orders(id, status)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setMarketplaceListings(marketplace || []);
      setP2pListings(p2p || []);
    } catch (error: any) {
      console.error("Error fetching listings:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canDeleteMarketplace = (listing: any) => {
    return !listing.marketplace_orders || listing.marketplace_orders.length === 0;
  };

  const canDeleteP2P = (listing: any) => {
    const activeOrders = listing.p2p_orders?.filter(
      (order: any) => order.status !== 'completed' && order.status !== 'cancelled'
    );
    return !activeOrders || activeOrders.length === 0;
  };

  const deleteMarketplaceListing = async (id: string) => {
    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setMarketplaceListings(prev => prev.filter(l => l.id !== id));
      
      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteP2PListing = async (id: string) => {
    try {
      const { error } = await supabase
        .from("p2p_listings")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setP2pListings(prev => prev.filter(l => l.id !== id));
      
      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="container p-4">Loading...</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>My Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="marketplace">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="marketplace">
                <Store className="h-4 w-4 mr-2" />
                Marketplace
              </TabsTrigger>
              <TabsTrigger value="p2p">
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                P2P
              </TabsTrigger>
            </TabsList>

            <TabsContent value="marketplace" className="space-y-4">
              {marketplaceListings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No marketplace listings yet</p>
              ) : (
                marketplaceListings.map((listing) => (
                  <Card key={listing.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold">{listing.title}</h3>
                          <p className="text-sm text-muted-foreground">{listing.description}</p>
                          <p className="mt-2 font-semibold">
                            {listing.price} {listing.currency}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {listing.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/marketplace/listing/${listing.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteMarketplaceListing(listing.id)}
                            disabled={!canDeleteMarketplace(listing)}
                            title={!canDeleteMarketplace(listing) ? "Cannot delete - has active orders" : ""}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="p2p" className="space-y-4">
              {p2pListings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No P2P listings yet</p>
              ) : (
                p2pListings.map((listing) => (
                  <Card key={listing.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold capitalize">
                            {listing.listing_type} {listing.token}
                          </h3>
                          <p className="text-sm">
                            Rate: {listing.rate} {listing.currency_code}
                          </p>
                          <p className="text-sm">
                            Amount: {listing.min_amount} - {listing.max_amount} {listing.token}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {listing.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteP2PListing(listing.id)}
                            disabled={!canDeleteP2P(listing)}
                            title={!canDeleteP2P(listing) ? "Cannot delete - has active orders" : ""}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
