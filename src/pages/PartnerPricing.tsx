import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, Rocket, Crown, ArrowRight, Wallet, ArrowRightLeft, Download, Upload, Shield, CreditCard, UserCheck, DollarSign, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  monthly_fee_usdt: number;
  rate_limit_per_minute: number;
  daily_api_limit: number | null;
  monthly_api_limit: number | null;
  max_api_keys: number;
  production_access: boolean;
  features: string[];
  transaction_fees: {
    transfers: number | null;
    payins: number | null;
    payouts_crypto: number | null;
    payouts_fiat: number | null;
    escrow: number | null;
    cards: number | null;
  };
}

const tierIcons: Record<string, React.ElementType> = {
  free: Zap,
  starter: Rocket,
  growth: Building2,
  enterprise: Crown
};

const tierColors: Record<string, string> = {
  free: "border-muted",
  starter: "border-primary/50",
  growth: "border-primary",
  enterprise: "border-yellow-500 bg-gradient-to-b from-yellow-500/5 to-transparent"
};

export default function PartnerPricing() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setTiers((data || []) as unknown as SubscriptionTier[]);
    } catch (error) {
      console.error('Error fetching tiers:', error);
      toast({
        title: "Error",
        description: "Failed to load pricing plans",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTier = (tierName: string) => {
    navigate(`/partner/register?tier=${tierName}`);
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null) return "Unlimited";
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(0)}M`;
    if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`;
    return limit.toString();
  };

  const apiCategories = [
    { icon: Wallet, name: "Wallets", desc: "Create & manage customer wallets" },
    { icon: ArrowRightLeft, name: "Transfers", desc: "Internal wallet transfers" },
    { icon: Download, name: "Pay-ins", desc: "Accept crypto payments" },
    { icon: Upload, name: "Payouts", desc: "Crypto & fiat disbursements" },
    { icon: Shield, name: "Escrow", desc: "Secure marketplace transactions" },
    { icon: CreditCard, name: "Virtual Cards", desc: "Issue & manage cards" },
    { icon: UserCheck, name: "KYC", desc: "Identity verification" },
    { icon: DollarSign, name: "FX Rates", desc: "Real-time exchange rates" },
    { icon: Webhook, name: "Webhooks", desc: "Event notifications" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">F</span>
            </div>
            <span className="font-bold text-xl">Finmo</span>
            <Badge variant="outline" className="ml-2">API</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/api-docs')}>
              Documentation
            </Button>
            <Button onClick={() => navigate('/partner/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge className="mb-4">Pay with USDT/USDC Only</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the plan that fits your business. Pay monthly with USDT or USDC.
            No credit cards, no banks — just crypto.
          </p>
        </div>
      </section>

      {/* API Categories */}
      <section className="pb-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {apiCategories.map((api) => (
              <div key={api.name} className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
                <api.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{api.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {tiers.map((tier) => {
              const TierIcon = tierIcons[tier.name] || Zap;
              const isPopular = tier.name === 'growth';
              
              return (
                <Card 
                  key={tier.id} 
                  className={`relative flex flex-col ${tierColors[tier.name]} ${isPopular ? 'ring-2 ring-primary' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <TierIcon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">{tier.display_name}</CardTitle>
                    <CardDescription>
                      {tier.production_access ? 'Production Ready' : 'Sandbox Only'}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold">
                          ${tier.monthly_fee_usdt}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                      {tier.monthly_fee_usdt > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          USDT or USDC
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rate Limit</span>
                        <span className="font-medium">{tier.rate_limit_per_minute} req/min</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Daily Calls</span>
                        <span className="font-medium">{formatLimit(tier.daily_api_limit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monthly Calls</span>
                        <span className="font-medium">{formatLimit(tier.monthly_api_limit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">API Keys</span>
                        <span className="font-medium">{tier.max_api_keys}</span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium mb-3">Features</p>
                      <ul className="space-y-2">
                        {(tier.features as string[]).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {tier.transaction_fees.transfers !== null && (
                      <div className="border-t border-border pt-4 mt-4">
                        <p className="text-sm font-medium mb-3">Transaction Fees</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Transfers</span>
                            <span>{tier.transaction_fees.transfers}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pay-ins</span>
                            <span>{tier.transaction_fees.payins}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payouts (Crypto)</span>
                            <span>{tier.transaction_fees.payouts_crypto}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payouts (Fiat)</span>
                            <span>{tier.transaction_fees.payouts_fiat}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Escrow</span>
                            <span>{tier.transaction_fees.escrow}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cards</span>
                            <span>{tier.transaction_fees.cards}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => handleSelectTier(tier.name)}
                    >
                      {tier.monthly_fee_usdt === 0 ? 'Start Free' : 'Get Started'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ / Additional Info */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">How Payment Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">Register & Select Plan</h3>
              <p className="text-sm text-muted-foreground">
                Create your partner account and choose a subscription tier
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">Send USDT/USDC</h3>
              <p className="text-sm text-muted-foreground">
                Transfer the subscription fee to your unique payment wallet address
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">Start Building</h3>
              <p className="text-sm text-muted-foreground">
                Once verified, get your API keys and start integrating
              </p>
            </div>
          </div>

          <div className="mt-12 p-6 rounded-xl bg-card border border-border">
            <h3 className="font-semibold mb-4">Accepted Payment Methods</h3>
            <div className="flex flex-wrap gap-4">
              <Badge variant="outline" className="px-4 py-2">
                <span className="font-mono">USDT</span>
                <span className="ml-2 text-muted-foreground">Tether</span>
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                <span className="font-mono">USDC</span>
                <span className="ml-2 text-muted-foreground">USD Coin</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Payments accepted on Polygon (recommended), Ethereum, Arbitrum, and Base networks.
              Polygon offers the lowest transaction fees.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            Join developers building the future of African fintech with Finmo's Partner API.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/partner/register')}>
              Create Partner Account
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/api-docs')}>
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Finmo. All rights reserved.</p>
          <p className="mt-2">
            <a href="mailto:adedayo@finmo.africa" className="hover:text-foreground">Contact Support</a>
            {" • "}
            <a href="/api-docs" className="hover:text-foreground">API Docs</a>
          </p>
        </div>
      </footer>
    </div>
  );
}