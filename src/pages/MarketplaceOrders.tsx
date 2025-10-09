import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MobileNav from "@/components/MobileNav";
import { ArrowLeft, Package, Truck } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  gifted_to_user_id: string | null;
  amount: number;
  currency: string;
  status: string;
  delivery_address: string;
  delivery_phone: string;
  delivery_name: string;
  created_at: string;
  marketplace_listings: {
    title: string;
    images: string[];
  };
}

const MarketplaceOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("marketplace_orders")
      .select(`
        *,
        marketplace_listings (
          title,
          images
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id},gifted_to_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      paid: "bg-blue-500",
      confirmed: "bg-purple-500",
      shipped: "bg-indigo-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
      disputed: "bg-orange-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const handleConfirmDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from("marketplace_orders")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to confirm delivery");
      console.error(error);
    } else {
      toast.success("Delivery confirmed!");
      fetchOrders();
    }
  };

  const myPurchases = orders.filter((o) => o.buyer_id === currentUserId);
  const mySales = orders.filter((o) => o.seller_id === currentUserId);
  const giftsReceived = orders.filter((o) => o.gifted_to_user_id === currentUserId);

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
          <h1 className="text-xl font-bold">My Orders</h1>
        </div>
      </div>

      <Tabs defaultValue="purchases" className="p-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="gifts">Gifts</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : myPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchases yet
            </div>
          ) : (
            myPurchases.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      {order.marketplace_listings?.images?.[0] ? (
                        <img
                          src={order.marketplace_listings.images[0]}
                          alt={order.marketplace_listings.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        {order.marketplace_listings?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order.amount} {order.currency}
                      </p>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      {order.status === "shipped" && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmDelivery(order.id)}
                          className="mt-2"
                        >
                          Confirm Delivery
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : mySales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales yet
            </div>
          ) : (
            mySales.map((order) => (
              <Card
                key={order.id}
                onClick={() => navigate(`/marketplace/order/${order.id}`)}
                className="cursor-pointer hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      {order.marketplace_listings?.images?.[0] ? (
                        <img
                          src={order.marketplace_listings.images[0]}
                          alt={order.marketplace_listings.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        {order.marketplace_listings?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order.amount} {order.currency}
                      </p>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      {order.status === "paid" && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Delivery Details:</p>
                          <p className="text-sm text-muted-foreground">
                            {order.delivery_name} - {order.delivery_phone}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="gifts" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : giftsReceived.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No gifts received
            </div>
          ) : (
            giftsReceived.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      {order.marketplace_listings?.images?.[0] ? (
                        <img
                          src={order.marketplace_listings.images[0]}
                          alt={order.marketplace_listings.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2">GIFT</Badge>
                      <h3 className="font-semibold mb-1">
                        {order.marketplace_listings?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order.amount} {order.currency}
                      </p>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <MobileNav />
    </div>
  );
};

export default MarketplaceOrders;
