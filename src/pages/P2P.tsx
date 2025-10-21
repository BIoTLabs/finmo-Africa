import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, TrendingDown, Filter, ChevronDown, Info, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileNav from "@/components/MobileNav";

interface P2PListing {
  id: string;
  listing_type: "buy" | "sell";
  token: string;
  country_code: string;
  currency_code: string;
  rate: number;
  min_amount: number;
  max_amount: number;
  available_amount: number;
  payment_time_limit: number;
  user_id: string;
}

const P2P = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<P2PListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string>("NG");
  const [selectedToken, setSelectedToken] = useState<string>("USDC");

  useEffect(() => {
    fetchListings();
  }, [selectedCountry, selectedToken]);

  const fetchListings = async () => {
    try {
      // Use the secure view that excludes payment_method_id
      const { data, error } = await supabase
        .from("p2p_listings_public")
        .select("*")
        .eq("country_code", selectedCountry)
        .eq("token", selectedToken)
        .order("rate", { ascending: true });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error("Error fetching listings:", error);
      toast.error("We couldn't load P2P listings. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    { code: "NG", name: "Nigeria", currency: "NGN" },
    { code: "KE", name: "Kenya", currency: "KES" },
    { code: "ZA", name: "South Africa", currency: "ZAR" },
    { code: "GH", name: "Ghana", currency: "GHS" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-semibold mx-2 truncate">P2P Marketplace</h1>
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* About P2P Section */}
      <div className="px-4 pt-4">
        <Collapsible>
          <Card className="shadow-finmo-md bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full p-4 h-auto flex items-center justify-between hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">About P2P Trading</h2>
                </div>
                <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 pt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Trade crypto directly with other users using your local payment methods. Set your own rates and terms.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Escrow Protection</p>
                      <p className="text-xs text-muted-foreground">Funds are held in escrow until both parties confirm</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Fast Settlements</p>
                      <p className="text-xs text-muted-foreground">Complete trades within minutes with instant transfers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Best Rates</p>
                      <p className="text-xs text-muted-foreground">Competitive market rates from multiple sellers</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Country & Token Selector */}
      <div className="p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {countries.map((country) => (
            <Button
              key={country.code}
              variant={selectedCountry === country.code ? "default" : "outline"}
              onClick={() => setSelectedCountry(country.code)}
              size="sm"
              className="whitespace-nowrap flex-shrink-0"
            >
              {country.name}
            </Button>
          ))}
        </div>

        <Tabs value={selectedToken} onValueChange={setSelectedToken}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="USDC">USDC</TabsTrigger>
            <TabsTrigger value="USDT">USDT</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button className="w-full" onClick={() => navigate("/p2p/create-listing")}>
          Create Listing
        </Button>
      </div>

      {/* Listings */}
      <div className="px-4 space-y-4">
        <Tabs defaultValue="buy">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy {selectedToken}</TabsTrigger>
            <TabsTrigger value="sell">Sell {selectedToken}</TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : (
              listings
                .filter((l) => l.listing_type === "sell")
                .map((listing) => (
                  <Card key={listing.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => navigate(`/p2p/order/${listing.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Merchant</p>
                          <p className="text-sm text-muted-foreground">
                            {listing.available_amount} {listing.token} available
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">{listing.rate}</p>
                          <p className="text-xs text-muted-foreground">{listing.currency_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Min: {listing.min_amount}</span>
                        <span>•</span>
                        <span>Max: {listing.max_amount}</span>
                        <span>•</span>
                        <span>{listing.payment_time_limit}min</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>

          <TabsContent value="sell" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : (
              listings
                .filter((l) => l.listing_type === "buy")
                .map((listing) => (
                  <Card key={listing.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => navigate(`/p2p/order/${listing.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Merchant</p>
                          <p className="text-sm text-muted-foreground">
                            {listing.available_amount} {listing.token} wanted
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">{listing.rate}</p>
                          <p className="text-xs text-muted-foreground">{listing.currency_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Min: {listing.min_amount}</span>
                        <span>•</span>
                        <span>Max: {listing.max_amount}</span>
                        <span>•</span>
                        <span>{listing.payment_time_limit}min</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <MobileNav />
    </div>
  );
};

export default P2P;
