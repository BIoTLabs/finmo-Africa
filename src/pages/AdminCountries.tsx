import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Globe, RefreshCw, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';

interface Country {
  id: string;
  country_code: string;
  country_name: string;
  country_iso: string;
  flag_emoji: string;
  phone_digits: number;
  phone_format: string;
  phone_example: string;
  is_enabled: boolean;
  is_beta: boolean;
  region: string;
  sort_order: number;
}

const AdminCountries = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCountries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supported_countries')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCountries(data || []);
    } catch (error: any) {
      console.error('Error fetching countries:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch countries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges',
        variant: 'destructive',
      });
    }
  }, [isAdmin, adminLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchCountries();
    }
  }, [isAdmin]);

  const toggleCountryEnabled = async (country: Country) => {
    setUpdating(country.id);
    try {
      const { error } = await supabase
        .from('supported_countries')
        .update({ is_enabled: !country.is_enabled, updated_at: new Date().toISOString() })
        .eq('id', country.id);

      if (error) throw error;

      setCountries(prev => prev.map(c => 
        c.id === country.id ? { ...c, is_enabled: !c.is_enabled } : c
      ));

      toast({
        title: country.is_enabled ? 'Country Disabled' : 'Country Enabled',
        description: `${country.country_name} has been ${country.is_enabled ? 'disabled' : 'enabled'} for registration`,
      });
    } catch (error: any) {
      console.error('Error updating country:', error);
      toast({
        title: 'Error',
        description: 'Failed to update country status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const toggleCountryBeta = async (country: Country) => {
    setUpdating(country.id);
    try {
      const { error } = await supabase
        .from('supported_countries')
        .update({ is_beta: !country.is_beta, updated_at: new Date().toISOString() })
        .eq('id', country.id);

      if (error) throw error;

      setCountries(prev => prev.map(c => 
        c.id === country.id ? { ...c, is_beta: !c.is_beta } : c
      ));

      toast({
        title: 'Beta Status Updated',
        description: `${country.country_name} beta status has been ${country.is_beta ? 'removed' : 'added'}`,
      });
    } catch (error: any) {
      console.error('Error updating country:', error);
      toast({
        title: 'Error',
        description: 'Failed to update country beta status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  if (adminLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return null;
  }

  const enabledCount = countries.filter(c => c.is_enabled).length;
  const betaCount = countries.filter(c => c.is_beta).length;

  // Group countries by region
  const countryGroups = countries.reduce((acc, country) => {
    const region = country.region || 'Other';
    if (!acc[region]) acc[region] = [];
    acc[region].push(country);
    return acc;
  }, {} as Record<string, Country[]>);

  const regions = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa', 'Central Africa', 'Other'];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Globe className="h-8 w-8" />
                Country Management
              </h1>
              <p className="text-muted-foreground">Enable or disable country access for user registration</p>
            </div>
          </div>
          <Button onClick={fetchCountries} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{countries.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enabled Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{enabledCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Beta Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{betaCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Countries by Region */}
        {regions.map(region => {
          const regionCountries = countryGroups[region];
          if (!regionCountries || regionCountries.length === 0) return null;

          return (
            <Card key={region} className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {region}
                </CardTitle>
                <CardDescription>
                  {regionCountries.filter(c => c.is_enabled).length} of {regionCountries.length} countries enabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Phone Format</TableHead>
                      <TableHead>Example</TableHead>
                      <TableHead className="text-center">Beta</TableHead>
                      <TableHead className="text-center">Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionCountries.map((country) => (
                      <TableRow key={country.id} className={!country.is_enabled ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{country.flag_emoji}</span>
                            <span>{country.country_name}</span>
                            {country.is_beta && (
                              <Badge variant="secondary" className="text-xs">Beta</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{country.country_code}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{country.phone_format}</TableCell>
                        <TableCell className="font-mono text-sm">{country.phone_example}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={country.is_beta}
                            onCheckedChange={() => toggleCountryBeta(country)}
                            disabled={updating === country.id}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={country.is_enabled}
                            onCheckedChange={() => toggleCountryEnabled(country)}
                            disabled={updating === country.id}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCountries;