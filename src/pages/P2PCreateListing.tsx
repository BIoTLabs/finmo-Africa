import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileNav from "@/components/MobileNav";

interface Country {
  code: string;
  name: string;
  currency: string;
}

const P2PCreateListing = () => {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [listingType, setListingType] = useState<"buy" | "sell">("sell");
  const [token, setToken] = useState("USDC");
  const [countryCode, setCountryCode] = useState("NG");
  const [rate, setRate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [availableAmount, setAvailableAmount] = useState("");
  const [paymentTimeLimit, setPaymentTimeLimit] = useState("15");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const { data, error } = await supabase
        .from("supported_countries")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      setCountries(data.map(c => ({
        code: c.country_code,
        name: c.country_name,
        currency: c.currency_code
      })));
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const handleCreateListing = async () => {
    if (!rate || !minAmount || !maxAmount || !availableAmount) {
      toast.error("Please fill in all required fields to create your listing.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedCountry = countries.find(c => c.code === countryCode);

      const { error } = await supabase
        .from("p2p_listings")
        .insert({
          user_id: user.id,
          listing_type: listingType,
          token,
          country_code: countryCode,
          currency_code: selectedCountry?.currency || "NGN",
          rate: parseFloat(rate),
          min_amount: parseFloat(minAmount),
          max_amount: parseFloat(maxAmount),
          available_amount: parseFloat(availableAmount),
          payment_time_limit: parseInt(paymentTimeLimit),
          terms: terms || null,
          is_active: true
        });

      if (error) throw error;

      toast.success("Listing created successfully!");
      navigate("/p2p");
    } catch (error: any) {
      console.error("Error creating listing:", error);
      toast.error("We couldn't create your P2P listing. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Create Listing</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Listing Type</Label>
              <Select value={listingType} onValueChange={(v: any) => setListingType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sell">Sell {token} (Others can buy from you)</SelectItem>
                  <SelectItem value="buy">Buy {token} (Others can sell to you)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cryptocurrency</Label>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(country => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name} ({country.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Exchange Rate (per 1 {token})</Label>
              <Input
                type="number"
                placeholder="1500"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Amount</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Max Amount</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Available Amount ({token})</Label>
              <Input
                type="number"
                placeholder="500"
                value={availableAmount}
                onChange={(e) => setAvailableAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>Payment Time Limit (minutes)</Label>
              <Select value={paymentTimeLimit} onValueChange={setPaymentTimeLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Terms (Optional)</Label>
              <Textarea
                placeholder="Enter any special terms or conditions..."
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleCreateListing}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Listing"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
};

export default P2PCreateListing;
