import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Copy, Check, ExternalLink, Key, BarChart3, 
  CreditCard, Clock, AlertCircle, RefreshCw, Wallet, LogIn
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PartnerData {
  id: string;
  company_name: string;
  contact_email: string;
  status: string;
  production_enabled: boolean;
  current_tier_id: string;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  payment_wallet_address: string;
  amount_due: number;
  amount_paid: number;
  tier: {
    name: string;
    display_name: string;
    monthly_fee_usdt: number;
    rate_limit_per_minute: number;
    daily_api_limit: number | null;
    monthly_api_limit: number | null;
    features: string[];
  };
}

interface UsageStats {
  daily_used: number;
  daily_limit: number | null;
  monthly_used: number;
  monthly_limit: number | null;
  tier_name: string;
  tier_display_name: string;
}

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check authentication and get partner data from authenticated user
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await fetchPartnerData(session.user.id);
      }
      
      setAuthChecked(true);
      setLoading(false);
    };
    
    checkAuth();
    
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          if (authChecked) {
            await fetchPartnerData(session.user.id);
          }
        } else {
          setUser(null);
          setPartner(null);
        }
      }
    );

    return () => authSub.unsubscribe();
  }, []);

  const fetchPartnerData = async (userId: string) => {
    try {
      setLoading(true);
      
      // Fetch partner info linked to this user
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (partnerError || !partnerData) {
        // No partner account linked to this user
        setPartner(null);
        setLoading(false);
        return;
      }
      
      setPartner(partnerData);

      // Fetch subscription using RLS (user can only see their own)
      const { data: subData } = await supabase
        .from('partner_subscriptions')
        .select(`
          *,
          tier:subscription_tiers(*)
        `)
        .eq('partner_id', partnerData.id)
        .single();

      if (subData) {
        setSubscription(subData as any);
      }

      // Fetch API keys using RLS
      const { data: keysData } = await supabase
        .from('partner_api_keys')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      setApiKeys(keysData || []);

      // Fetch payments using RLS
      const { data: paymentsData } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setPayments(paymentsData || []);

      // Fetch usage stats
      const { data: usageData } = await supabase
        .rpc('get_partner_usage_stats', { _partner_id: partnerData.id });

      if (usageData && typeof usageData === 'object') {
        setUsage(usageData as unknown as UsageStats);
      }

    } catch (error) {
      console.error('Error fetching partner data:', error);
      toast({
        title: "Error",
        description: "Failed to load partner data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending: "secondary",
      past_due: "destructive",
      cancelled: "outline",
      expired: "destructive"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateProgress = (used: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Partner Dashboard</CardTitle>
            <CardDescription>
              Please log in to access your partner dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/auth')} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Log In
            </Button>
            <Button variant="outline" onClick={() => navigate('/partner/register')} className="w-full">
              Register as Partner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated but no partner account
  if (!partner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Partner Account</CardTitle>
            <CardDescription>
              You don't have a partner account linked to your user. Register to become a partner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/partner/register')} className="w-full">
              Register as Partner
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-xl">{partner.company_name}</h1>
              <p className="text-sm text-muted-foreground">{partner.contact_email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {getStatusBadge(partner.status)}
            <Button variant="outline" size="sm" onClick={() => user && fetchPartnerData(user.id)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Subscription Status Alert */}
        {subscription?.status === 'pending' && subscription.tier.monthly_fee_usdt > 0 && (
          <Card className="mb-6 border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-yellow-500 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">Payment Required</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send ${subscription.amount_due} USDT/USDC to activate your {subscription.tier.display_name} subscription.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg font-mono text-sm">
                      <Wallet className="h-4 w-4" />
                      <span className="truncate max-w-[200px] md:max-w-none">
                        {subscription.payment_wallet_address}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(subscription.payment_wallet_address, 'Wallet address')}
                      >
                        {copied === 'Wallet address' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Badge variant="outline">Polygon Recommended</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Subscription Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {subscription?.tier?.display_name || 'Free'}
                    </span>
                    {subscription && getStatusBadge(subscription.status)}
                  </div>
                  {subscription && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Renews {formatDate(subscription.current_period_end)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* API Calls Today */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    API Calls Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usage?.daily_used?.toLocaleString() || 0}
                    {usage?.daily_limit && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}/ {usage.daily_limit.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {usage?.daily_limit && (
                    <Progress 
                      value={calculateProgress(usage.daily_used, usage.daily_limit)} 
                      className="mt-2 h-2"
                    />
                  )}
                </CardContent>
              </Card>

              {/* API Calls This Month */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    API Calls This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usage?.monthly_used?.toLocaleString() || 0}
                    {usage?.monthly_limit && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}/ {usage.monthly_limit.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {usage?.monthly_limit && (
                    <Progress 
                      value={calculateProgress(usage.monthly_used, usage.monthly_limit)} 
                      className="mt-2 h-2"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button variant="outline" onClick={() => navigate('/api-docs')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  API Documentation
                </Button>
                <Button variant="outline" onClick={() => navigate('/partner/pricing')}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage your API keys. Keep them secure and never share them publicly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <p className="text-muted-foreground">No API keys yet. Contact support to get started.</p>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono">{key.key_prefix}...</span>
                            <Badge variant={key.is_active ? "default" : "secondary"}>
                              {key.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">{key.environment}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {key.name || 'Unnamed key'} • Created {formatDate(key.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>API Usage</CardTitle>
                <CardDescription>
                  Monitor your API usage and rate limits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Daily Requests</span>
                      <span className="text-sm text-muted-foreground">
                        {usage?.daily_used || 0} / {usage?.daily_limit || 'Unlimited'}
                      </span>
                    </div>
                    <Progress 
                      value={calculateProgress(usage?.daily_used || 0, usage?.daily_limit)} 
                      className="h-3"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Monthly Requests</span>
                      <span className="text-sm text-muted-foreground">
                        {usage?.monthly_used || 0} / {usage?.monthly_limit || 'Unlimited'}
                      </span>
                    </div>
                    <Progress 
                      value={calculateProgress(usage?.monthly_used || 0, usage?.monthly_limit)} 
                      className="h-3"
                    />
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Rate Limit</span>
                      <Badge variant="outline">
                        {subscription?.tier?.rate_limit_per_minute || 30} requests/minute
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Current Subscription */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-medium">{subscription.tier.display_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        {getStatusBadge(subscription.status)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Cost</span>
                        <span className="font-medium">
                          {subscription.tier.monthly_fee_usdt === 0 
                            ? 'Free' 
                            : `$${subscription.tier.monthly_fee_usdt} USDT/USDC`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Period</span>
                        <span className="font-medium">
                          {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">No active subscription</p>
                      <Button onClick={() => navigate('/partner/pricing')}>
                        View Plans
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Wallet */}
              {subscription && subscription.tier.monthly_fee_usdt > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Wallet</CardTitle>
                    <CardDescription>
                      Send USDT or USDC to this address to pay for your subscription.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm break-all">
                          {subscription.payment_wallet_address}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="shrink-0"
                          onClick={() => copyToClipboard(subscription.payment_wallet_address, 'Wallet address')}
                        >
                          {copied === 'Wallet address' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Polygon (Recommended)</Badge>
                        <Badge variant="outline">Ethereum</Badge>
                        <Badge variant="outline">Arbitrum</Badge>
                        <Badge variant="outline">Base</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Payment History */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground">No payments yet.</p>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">${payment.amount} {payment.token}</span>
                            <Badge variant={payment.status === 'confirmed' ? "default" : "secondary"}>
                              {payment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(payment.created_at)} • {payment.chain_name || `Chain ${payment.chain_id}`}
                          </p>
                        </div>
                        {payment.tx_hash && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`https://polygonscan.com/tx/${payment.tx_hash}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}