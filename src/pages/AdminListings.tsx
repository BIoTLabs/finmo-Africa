import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Store, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MarketplaceListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  is_active: boolean;
  seller_id: string;
  created_at: string;
}

interface P2PListing {
  id: string;
  listing_type: string;
  token: string;
  rate: number;
  currency_code: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

const AdminListings = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [p2pListings, setP2PListings] = useState<P2PListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<{ id: string; type: 'marketplace' | 'p2p' } | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
      toast.error("Access denied");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchListings();
    }
  }, [isAdmin]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const [marketplaceData, p2pData] = await Promise.all([
        supabase
          .from("marketplace_listings")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("p2p_listings")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (marketplaceData.error) throw marketplaceData.error;
      if (p2pData.error) throw p2pData.error;

      setMarketplaceListings(marketplaceData.data || []);
      setP2PListings(p2pData.data || []);
    } catch (error: any) {
      console.error("Error fetching listings:", error);
      toast.error(error.message || "Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMarketplaceListing = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Listing ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchListings();
    } catch (error: any) {
      console.error("Error updating listing:", error);
      toast.error(error.message || "Failed to update listing");
    }
    setSelectedListing(null);
  };

  const handleToggleP2PListing = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("p2p_listings")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Listing ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchListings();
    } catch (error: any) {
      console.error("Error updating listing:", error);
      toast.error(error.message || "Failed to update listing");
    }
    setSelectedListing(null);
  };

  if (adminLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Listing Management</h1>
            <p className="text-muted-foreground">Review and manage marketplace and P2P listings</p>
          </div>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="marketplace">
              <Store className="h-4 w-4 mr-2" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="p2p">
              <Users className="h-4 w-4 mr-2" />
              P2P Listings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Listings</CardTitle>
                <CardDescription>
                  Review and manage all marketplace listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketplaceListings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell className="font-medium">{listing.title}</TableCell>
                        <TableCell>
                          {listing.price} {listing.currency}
                        </TableCell>
                        <TableCell>
                          <Badge variant={listing.is_active ? "default" : "secondary"}>
                            {listing.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(listing.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={listing.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => setSelectedListing({ id: listing.id, type: 'marketplace' })}
                          >
                            {listing.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="p2p">
            <Card>
              <CardHeader>
                <CardTitle>P2P Listings</CardTitle>
                <CardDescription>
                  Review and manage all P2P trade listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p2pListings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          <Badge variant={listing.listing_type === 'buy' ? 'default' : 'secondary'}>
                            {listing.listing_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{listing.token}</TableCell>
                        <TableCell>
                          {listing.rate} {listing.currency_code}
                        </TableCell>
                        <TableCell>
                          <Badge variant={listing.is_active ? "default" : "secondary"}>
                            {listing.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(listing.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={listing.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => setSelectedListing({ id: listing.id, type: 'p2p' })}
                          >
                            {listing.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {selectedListing && 
                (selectedListing.type === 'marketplace' 
                  ? marketplaceListings.find(l => l.id === selectedListing.id)?.is_active 
                  : p2pListings.find(l => l.id === selectedListing.id)?.is_active) 
                ? 'deactivate' : 'activate'} this listing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedListing) {
                  if (selectedListing.type === 'marketplace') {
                    const listing = marketplaceListings.find(l => l.id === selectedListing.id);
                    if (listing) handleToggleMarketplaceListing(selectedListing.id, listing.is_active);
                  } else {
                    const listing = p2pListings.find(l => l.id === selectedListing.id);
                    if (listing) handleToggleP2PListing(selectedListing.id, listing.is_active);
                  }
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListings;
