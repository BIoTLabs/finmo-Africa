import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Building2, Key, Plus, RefreshCw, Check, X, Eye, Copy, Webhook, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';

interface Partner {
  id: string;
  company_name: string;
  business_type: string | null;
  country_code: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  api_tier: string;
  sandbox_enabled: boolean;
  production_enabled: boolean;
  created_at: string;
  approved_at: string | null;
}

interface ApiKey {
  id: string;
  partner_id: string;
  key_prefix: string;
  name: string | null;
  environment: string;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  'wallets:read',
  'wallets:write',
  'transfers:read',
  'transfers:write',
  'fx:read',
  'webhooks:read',
  'webhooks:write',
  'payouts:read',
  'payouts:write',
  'payins:read',
  'payins:write'
];

const AdminPartnerManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  
  // Create partner dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({
    company_name: '',
    business_type: 'fintech',
    country_code: 'KE',
    contact_email: '',
    contact_phone: '',
    api_tier: 'free'
  });
  
  // Create API key dialog
  const [createKeyDialogOpen, setCreateKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    environment: 'sandbox',
    scopes: ['wallets:read', 'transfers:read'],
    rate_limit_per_minute: 60
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

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
      fetchPartners();
    }
  }, [isAdmin]);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      console.error('Error fetching partners:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch partners',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async (partnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('partner_api_keys')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: any) {
      console.error('Error fetching API keys:', error);
    }
  };

  const createPartner = async () => {
    try {
      // Get current user for user_id (now required)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create a partner',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('partners')
        .insert({
          company_name: newPartner.company_name,
          business_type: newPartner.business_type,
          country_code: newPartner.country_code,
          contact_email: newPartner.contact_email,
          contact_phone: newPartner.contact_phone || null,
          api_tier: newPartner.api_tier,
          user_id: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Partner Created',
        description: `${data.company_name} has been registered`,
      });

      setCreateDialogOpen(false);
      setNewPartner({
        company_name: '',
        business_type: 'fintech',
        country_code: 'KE',
        contact_email: '',
        contact_phone: '',
        api_tier: 'free'
      });
      fetchPartners();
    } catch (error: any) {
      console.error('Error creating partner:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create partner',
        variant: 'destructive',
      });
    }
  };

  const updatePartnerStatus = async (partnerId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'approved') {
        const { data: { user } } = await supabase.auth.getUser();
        updates.approved_at = new Date().toISOString();
        updates.approved_by = user?.id;
      }

      const { error } = await supabase
        .from('partners')
        .update(updates)
        .eq('id', partnerId);

      if (error) throw error;

      toast({
        title: 'Status Updated',
        description: `Partner status changed to ${status}`,
      });

      fetchPartners();
      if (selectedPartner?.id === partnerId) {
        setSelectedPartner(prev => prev ? { ...prev, status } : null);
      }
    } catch (error: any) {
      console.error('Error updating partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to update partner status',
        variant: 'destructive',
      });
    }
  };

  const toggleProductionAccess = async (partnerId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ production_enabled: enabled })
        .eq('id', partnerId);

      if (error) throw error;

      toast({
        title: enabled ? 'Production Enabled' : 'Production Disabled',
        description: `Production API access has been ${enabled ? 'enabled' : 'disabled'}`,
      });

      fetchPartners();
      if (selectedPartner?.id === partnerId) {
        setSelectedPartner(prev => prev ? { ...prev, production_enabled: enabled } : null);
      }
    } catch (error: any) {
      console.error('Error updating production access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update production access',
        variant: 'destructive',
      });
    }
  };

  const createApiKey = async () => {
    if (!selectedPartner) return;

    try {
      // Generate API key
      const { data: keyData } = await supabase.rpc('generate_api_key');
      const apiKey = keyData as string;
      
      // Hash the key for storage
      const { data: hashData } = await supabase.rpc('hash_api_key', { _key: apiKey });
      
      const { error } = await supabase
        .from('partner_api_keys')
        .insert({
          partner_id: selectedPartner.id,
          key_hash: hashData,
          key_prefix: apiKey.substring(0, 8),
          name: newApiKey.name || `${newApiKey.environment} key`,
          environment: newApiKey.environment,
          scopes: newApiKey.scopes,
          rate_limit_per_minute: newApiKey.rate_limit_per_minute
        });

      if (error) throw error;

      setGeneratedKey(apiKey);
      toast({
        title: 'API Key Created',
        description: 'Copy the key now - it will not be shown again',
      });

      fetchApiKeys(selectedPartner.id);
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        variant: 'destructive',
      });
    }
  };

  const toggleApiKey = async (keyId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('partner_api_keys')
        .update({ is_active: active })
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: active ? 'Key Activated' : 'Key Deactivated',
      });

      if (selectedPartner) {
        fetchApiKeys(selectedPartner.id);
      }
    } catch (error: any) {
      console.error('Error toggling API key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      approved: 'default',
      pending: 'secondary',
      suspended: 'destructive',
      rejected: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Partner API Management</h1>
              <p className="text-muted-foreground">Manage partner integrations and API access</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchPartners} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Partner</DialogTitle>
                  <DialogDescription>
                    Add a new organization to the Partner API program
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={newPartner.company_name}
                      onChange={(e) => setNewPartner({ ...newPartner, company_name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Select
                      value={newPartner.business_type}
                      onValueChange={(v) => setNewPartner({ ...newPartner, business_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="fintech">Fintech</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="startup">Startup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select
                      value={newPartner.country_code}
                      onValueChange={(v) => setNewPartner({ ...newPartner, country_code: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KE">Kenya</SelectItem>
                        <SelectItem value="NG">Nigeria</SelectItem>
                        <SelectItem value="UG">Uganda</SelectItem>
                        <SelectItem value="TZ">Tanzania</SelectItem>
                        <SelectItem value="GH">Ghana</SelectItem>
                        <SelectItem value="ZA">South Africa</SelectItem>
                        <SelectItem value="RW">Rwanda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      value={newPartner.contact_email}
                      onChange={(e) => setNewPartner({ ...newPartner, contact_email: e.target.value })}
                      placeholder="partner@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      value={newPartner.contact_phone}
                      onChange={(e) => setNewPartner({ ...newPartner, contact_phone: e.target.value })}
                      placeholder="+254..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Tier</Label>
                    <Select
                      value={newPartner.api_tier}
                      onValueChange={(v) => setNewPartner({ ...newPartner, api_tier: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free (60 req/min)</SelectItem>
                        <SelectItem value="growth">Growth (300 req/min)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (1000 req/min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createPartner} disabled={!newPartner.company_name || !newPartner.contact_email}>
                    Create Partner
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Partners List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Partners ({partners.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPartner?.id === partner.id ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      setSelectedPartner(partner);
                      fetchApiKeys(partner.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{partner.company_name}</span>
                      {getStatusBadge(partner.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{partner.business_type}</p>
                  </div>
                ))}
                {partners.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No partners yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Partner Details */}
          <div className="lg:col-span-2">
            {selectedPartner ? (
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                  <TabsTrigger value="usage">Usage</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedPartner.company_name}</CardTitle>
                      <CardDescription>Partner organization details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Business Type</Label>
                          <p className="font-medium capitalize">{selectedPartner.business_type}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Country</Label>
                          <p className="font-medium">{selectedPartner.country_code}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <p className="font-medium">{selectedPartner.contact_email}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Phone</Label>
                          <p className="font-medium">{selectedPartner.contact_phone || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <div className="mt-1">{getStatusBadge(selectedPartner.status)}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">API Tier</Label>
                          <p className="font-medium capitalize">{selectedPartner.api_tier}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Sandbox Access</Label>
                          <Badge variant={selectedPartner.sandbox_enabled ? 'default' : 'secondary'}>
                            {selectedPartner.sandbox_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Production Access</Label>
                          <Badge variant={selectedPartner.production_enabled ? 'default' : 'secondary'}>
                            {selectedPartner.production_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </div>

                      <div className="pt-4 border-t space-y-2">
                        <Label>Actions</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedPartner.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updatePartnerStatus(selectedPartner.id, 'approved')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updatePartnerStatus(selectedPartner.id, 'rejected')}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {selectedPartner.status === 'approved' && (
                            <>
                              <Button
                                size="sm"
                                variant={selectedPartner.production_enabled ? 'destructive' : 'default'}
                                onClick={() => toggleProductionAccess(selectedPartner.id, !selectedPartner.production_enabled)}
                              >
                                {selectedPartner.production_enabled ? 'Disable Production' : 'Enable Production'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updatePartnerStatus(selectedPartner.id, 'suspended')}
                              >
                                Suspend
                              </Button>
                            </>
                          )}
                          {selectedPartner.status === 'suspended' && (
                            <Button
                              size="sm"
                              onClick={() => updatePartnerStatus(selectedPartner.id, 'approved')}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="api-keys">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Key className="h-5 w-5" />
                          API Keys
                        </CardTitle>
                        <CardDescription>Manage API keys for this partner</CardDescription>
                      </div>
                      <Dialog open={createKeyDialogOpen} onOpenChange={(open) => {
                        setCreateKeyDialogOpen(open);
                        if (!open) setGeneratedKey(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" disabled={selectedPartner.status !== 'approved'}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Key
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create API Key</DialogTitle>
                            <DialogDescription>
                              {generatedKey 
                                ? 'Copy your API key now. It will not be shown again.'
                                : 'Configure the new API key settings'
                              }
                            </DialogDescription>
                          </DialogHeader>
                          
                          {generatedKey ? (
                            <div className="space-y-4 py-4">
                              <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                                {generatedKey}
                              </div>
                              <Button
                                className="w-full"
                                onClick={() => copyToClipboard(generatedKey)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy API Key
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Key Name</Label>
                                  <Input
                                    value={newApiKey.name}
                                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                                    placeholder="Production API Key"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Environment</Label>
                                  <Select
                                    value={newApiKey.environment}
                                    onValueChange={(v) => setNewApiKey({ ...newApiKey, environment: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="sandbox">Sandbox</SelectItem>
                                      <SelectItem value="production" disabled={!selectedPartner.production_enabled}>
                                        Production {!selectedPartner.production_enabled && '(not enabled)'}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Rate Limit (req/min)</Label>
                                  <Input
                                    type="number"
                                    value={newApiKey.rate_limit_per_minute}
                                    onChange={(e) => setNewApiKey({ ...newApiKey, rate_limit_per_minute: parseInt(e.target.value) })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Scopes</Label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {AVAILABLE_SCOPES.map((scope) => (
                                      <label key={scope} className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={newApiKey.scopes.includes(scope)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setNewApiKey({ ...newApiKey, scopes: [...newApiKey.scopes, scope] });
                                            } else {
                                              setNewApiKey({ ...newApiKey, scopes: newApiKey.scopes.filter(s => s !== scope) });
                                            }
                                          }}
                                          className="rounded"
                                        />
                                        {scope}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateKeyDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={createApiKey}>
                                  Generate Key
                                </Button>
                              </DialogFooter>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {apiKeys.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Prefix</TableHead>
                              <TableHead>Environment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Used</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apiKeys.map((key) => (
                              <TableRow key={key.id}>
                                <TableCell>{key.name || '-'}</TableCell>
                                <TableCell className="font-mono">{key.key_prefix}...</TableCell>
                                <TableCell>
                                  <Badge variant={key.environment === 'production' ? 'default' : 'secondary'}>
                                    {key.environment}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={key.is_active ? 'default' : 'destructive'}>
                                    {key.is_active ? 'Active' : 'Disabled'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {key.last_used_at 
                                    ? new Date(key.last_used_at).toLocaleDateString()
                                    : 'Never'
                                  }
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant={key.is_active ? 'destructive' : 'default'}
                                    onClick={() => toggleApiKey(key.id, !key.is_active)}
                                  >
                                    {key.is_active ? 'Disable' : 'Enable'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No API keys created yet</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="usage">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        API Usage
                      </CardTitle>
                      <CardDescription>Request statistics and analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-center text-muted-foreground py-8">
                        Usage analytics coming soon
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a partner to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPartnerManagement;