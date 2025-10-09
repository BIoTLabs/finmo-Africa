import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MobileNav from "@/components/MobileNav";
import { ArrowLeft, Plus, Search, Store } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

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
  category_id: string;
  created_at: string;
}

const Marketplace = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("marketplace_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Failed to load categories");
      console.error(error);
    } else {
      setCategories(data || []);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    let query = supabase
      .from("marketplace_listings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (selectedCategory !== "all") {
      query = query.eq("category_id", selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load listings");
      console.error(error);
    } else {
      setListings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchListings();
  }, [selectedCategory]);

  const filteredListings = listings.filter((listing) =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6" />
            <h1 className="text-xl font-bold">Marketplace</h1>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background text-foreground"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Create Listing Button */}
      <div className="px-4 pb-4">
        <Button
          onClick={() => navigate("/marketplace/create")}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="px-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading listings...
            </div>
          ) : filteredListings.filter(l => !l.is_service).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredListings.filter(l => !l.is_service).map((listing) => (
                <Card
                  key={listing.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/marketplace/listing/${listing.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center">
                      {listing.images && listing.images.length > 0 ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      ) : (
                        <Store className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                        {listing.title}
                      </h3>
                      <p className="text-lg font-bold text-primary">
                        {listing.price} {listing.currency}
                      </p>
                      {listing.condition && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {listing.condition}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading services...
            </div>
          ) : filteredListings.filter(l => l.is_service).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No services found
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredListings.filter(l => l.is_service).map((listing) => (
                <Card
                  key={listing.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/marketplace/listing/${listing.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        {listing.images && listing.images.length > 0 ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Store className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-1 mb-1">
                          {listing.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {listing.description}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {listing.price} {listing.currency}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MobileNav />
    </div>
  );
};

export default Marketplace;
