import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, TrendingUp, DollarSign, Globe, Coins, Download, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  useOverviewMetrics,
  useRevenueAnalytics,
  useTokenAnalytics,
  useCountryAnalytics,
  useFeatureAnalytics,
  useUserAnalytics,
  DateRange,
} from "@/hooks/useAnalytics";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import LoadingScreen from "@/components/LoadingScreen";
import { toast } from "sonner";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(199, 89%, 48%)'];

// Empty state component for charts
const EmptyChartState = ({ message = "No data available" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
    <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
    <p className="text-sm">{message}</p>
    <p className="text-xs mt-1">Try selecting a different date range</p>
  </div>
);

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [dateRangeOption, setDateRangeOption] = useState("30");
  const [retryTrigger, setRetryTrigger] = useState(0);
  
  // Redirect non-admins
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Access denied - admin privileges required");
      navigate('/dashboard');
    }
  }, [isAdmin, adminLoading, navigate]);
  
  const dateRange: DateRange | null = dateRangeOption === "all" 
    ? null 
    : {
        from: startOfDay(subDays(new Date(), parseInt(dateRangeOption))),
        to: endOfDay(new Date()),
      };

  // Only fetch data after admin is verified
  const isReady = isAdmin && !adminLoading;
  
  const { data: overview, loading: overviewLoading, error: overviewError } = useOverviewMetrics(dateRange, isReady, retryTrigger);
  const { data: revenueData, loading: revenueLoading, error: revenueError } = useRevenueAnalytics(dateRange, isReady, retryTrigger);
  const { data: tokenData, loading: tokenLoading, error: tokenError } = useTokenAnalytics(dateRange, isReady, retryTrigger);
  const { data: countryData, loading: countryLoading, error: countryError } = useCountryAnalytics(dateRange, isReady, retryTrigger);
  const { data: featureData, loading: featureLoading, error: featureError } = useFeatureAnalytics(dateRange, isReady, retryTrigger);
  const { data: userData, loading: userLoading, error: userError } = useUserAnalytics(dateRange, isReady, retryTrigger);

  const hasAnyError = overviewError || revenueError || tokenError || countryError || featureError || userError;
  const isAnyLoading = overviewLoading || revenueLoading || tokenLoading || countryLoading || featureLoading || userLoading;

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
    toast.info("Retrying data fetch...");
  };

  // Show loading while checking admin status
  if (adminLoading) {
    return <LoadingScreen />;
  }
  
  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Analytics & Reports</h1>
              <p className="text-muted-foreground text-sm">Platform performance insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRangeOption} onValueChange={setDateRangeOption}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error Alert with Retry */}
        {hasAnyError && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Some data failed to load</p>
                  <p className="text-sm text-muted-foreground">
                    {overviewError || revenueError || tokenError || countryError || featureError || userError}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
                disabled={isAnyLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isAnyLoading ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MetricCard
            title="Total Users"
            value={overview?.totalUsers || 0}
            icon={<Users className="h-4 w-4" />}
            change={overview?.userGrowth}
            loading={overviewLoading}
          />
          <MetricCard
            title="Transactions"
            value={overview?.totalTransactions || 0}
            icon={<TrendingUp className="h-4 w-4" />}
            loading={overviewLoading}
          />
          <MetricCard
            title="Total Revenue"
            value={`$${(overview?.totalRevenue || 0).toLocaleString()}`}
            icon={<DollarSign className="h-4 w-4" />}
            change={overview?.revenueGrowth}
            loading={overviewLoading}
          />
          <MetricCard
            title="Active Countries"
            value={overview?.activeCountries || 0}
            icon={<Globe className="h-4 w-4" />}
            loading={overviewLoading}
          />
          <MetricCard
            title="Total Staked"
            value={`$${(overview?.totalStaked || 0).toLocaleString()}`}
            icon={<Coins className="h-4 w-4" />}
            loading={overviewLoading}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(revenueData, 'revenue-report')}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue Over Time</CardTitle>
                  <CardDescription>Daily revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : revenueData.length === 0 ? (
                    <EmptyChartState message="No revenue data recorded yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Legend />
                        <Area type="monotone" dataKey="p2p" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} name="P2P Fees" />
                        <Area type="monotone" dataKey="marketplace" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} name="Marketplace" />
                        <Area type="monotone" dataKey="withdrawal" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} name="Withdrawals" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue by Source</CardTitle>
                  <CardDescription>Distribution of revenue streams</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : revenueData.length === 0 ? (
                    <EmptyChartState message="No revenue data to display" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'P2P Fees', value: revenueData.reduce((sum, r) => sum + r.p2p, 0) },
                            { name: 'Marketplace', value: revenueData.reduce((sum, r) => sum + r.marketplace, 0) },
                            { name: 'Withdrawals', value: revenueData.reduce((sum, r) => sum + r.withdrawal, 0) },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tokens Tab */}
          <TabsContent value="tokens" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(tokenData, 'token-report')}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction Volume by Token</CardTitle>
                  <CardDescription>Total volume in selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  {tokenLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : tokenData.length === 0 ? (
                    <EmptyChartState message="No token transaction data" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={tokenData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="token" type="category" tick={{ fontSize: 12 }} width={60} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="volume" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Staking by Token</CardTitle>
                  <CardDescription>Active staking positions</CardDescription>
                </CardHeader>
                <CardContent>
                  {tokenLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : tokenData.filter(t => t.staked > 0).length === 0 ? (
                    <EmptyChartState message="No staking positions yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={tokenData.filter(t => t.staked > 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="token" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="staked" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Token Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Token</th>
                        <th className="text-right py-2 font-medium">Transactions</th>
                        <th className="text-right py-2 font-medium">Volume</th>
                        <th className="text-right py-2 font-medium">Staked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenData.map((token) => (
                        <tr key={token.token} className="border-b border-muted">
                          <td className="py-2 font-medium">{token.token}</td>
                          <td className="text-right py-2">{token.transactions.toLocaleString()}</td>
                          <td className="text-right py-2">${token.volume.toLocaleString()}</td>
                          <td className="text-right py-2">${token.staked.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Countries Tab */}
          <TabsContent value="countries" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(countryData, 'country-report')}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Users by Country</CardTitle>
                  <CardDescription>User distribution across Africa</CardDescription>
                </CardHeader>
                <CardContent>
                  {countryLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : countryData.length === 0 ? (
                    <EmptyChartState message="No user data by country" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={countryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis 
                          dataKey="country_name" 
                          type="category" 
                          tick={{ fontSize: 12 }} 
                          width={100}
                          tickFormatter={(value, index) => `${countryData[index]?.flag || ''} ${value}`}
                        />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="users" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Country Distribution</CardTitle>
                  <CardDescription>Percentage of users by country</CardDescription>
                </CardHeader>
                <CardContent>
                  {countryLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : countryData.length === 0 ? (
                    <EmptyChartState message="No country distribution data" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={countryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ country_name, percent }) => `${country_name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          dataKey="users"
                        >
                          {countryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(featureData, 'feature-report')}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feature Usage</CardTitle>
                  <CardDescription>Number of times each feature was used</CardDescription>
                </CardHeader>
                <CardContent>
                  {featureLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={featureData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="usage" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feature Revenue</CardTitle>
                  <CardDescription>Revenue generated by each feature</CardDescription>
                </CardHeader>
                <CardContent>
                  {featureLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={featureData.filter(f => f.revenue > 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="revenue" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Feature Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {featureData.map((feature) => (
                    <div key={feature.feature} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">{feature.feature}</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Usage: <span className="text-foreground font-medium">{feature.usage}</span></p>
                        <p className="text-muted-foreground">Users: <span className="text-foreground font-medium">{feature.users}</span></p>
                        <p className="text-muted-foreground">Revenue: <span className="text-foreground font-medium">${feature.revenue.toLocaleString()}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(userData, 'user-report')}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Growth</CardTitle>
                  <CardDescription>Total users over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {userLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={userData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Legend />
                        <Line type="monotone" dataKey="total" stroke={COLORS[0]} strokeWidth={2} name="Total Users" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">New Registrations</CardTitle>
                  <CardDescription>Daily new user signups</CardDescription>
                </CardHeader>
                <CardContent>
                  {userLoading ? (
                    <Skeleton className="h-[300px]" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={userData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="new" fill={COLORS[2]} radius={[4, 4, 0, 0]} name="New Users" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  change, 
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode;
  change?: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          {icon}
          <span>{title}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={`text-xs mt-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
