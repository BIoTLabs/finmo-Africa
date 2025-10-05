import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, Zap, Shield, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';
import { AdminFeeSettings } from '@/components/AdminFeeSettings';

interface BackendInfo {
  timestamp: string;
  database: {
    functions: string[];
    tables: string[];
    tableCounts: Record<string, number>;
  };
  edgeFunctions: string[];
  integrations: {
    authentication: boolean;
    realtimeEnabled: boolean;
    storageEnabled: boolean;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBackendInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-backend-info');

      if (error) throw error;

      setBackendInfo(data);
    } catch (error: any) {
      console.error('Error fetching backend info:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch backend information',
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
      fetchBackendInfo();
    }
  }, [isAdmin]);

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
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Backend Functions & Integrations Review</p>
            </div>
          </div>
          <Button onClick={fetchBackendInfo} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {backendInfo && (
          <div className="space-y-6">
            {/* Fee Settings Section */}
            <AdminFeeSettings />

            {/* Backend Info Tabs */}
            <Tabs defaultValue="database" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="database">
                <Database className="h-4 w-4 mr-2" />
                Database
              </TabsTrigger>
              <TabsTrigger value="functions">
                <Zap className="h-4 w-4 mr-2" />
                Edge Functions
              </TabsTrigger>
              <TabsTrigger value="integrations">
                <Shield className="h-4 w-4 mr-2" />
                Integrations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Database Tables</CardTitle>
                  <CardDescription>
                    Overview of all database tables and row counts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table Name</TableHead>
                        <TableHead>Row Count</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backendInfo.database.tables.map((table) => (
                        <TableRow key={table}>
                          <TableCell className="font-medium">{table}</TableCell>
                          <TableCell>{backendInfo.database.tableCounts[table] || 0}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database Functions</CardTitle>
                  <CardDescription>
                    List of all registered database functions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {backendInfo.database.functions.map((func) => (
                      <div
                        key={func}
                        className="p-3 border rounded-lg bg-card hover:bg-accent transition-colors"
                      >
                        <code className="text-sm font-mono">{func}()</code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="functions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Edge Functions</CardTitle>
                  <CardDescription>
                    Serverless functions deployed in the backend
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {backendInfo.edgeFunctions.map((func) => (
                      <div
                        key={func}
                        className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <div>
                          <code className="text-sm font-mono font-semibold">{func}</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Status: <Badge variant="secondary">Deployed</Badge>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Integrations</CardTitle>
                  <CardDescription>
                    Overview of enabled backend services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">Authentication</h3>
                        <p className="text-sm text-muted-foreground">User authentication system</p>
                      </div>
                      <Badge variant={backendInfo.integrations.authentication ? 'default' : 'secondary'}>
                        {backendInfo.integrations.authentication ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">Realtime</h3>
                        <p className="text-sm text-muted-foreground">Real-time data synchronization</p>
                      </div>
                      <Badge variant={backendInfo.integrations.realtimeEnabled ? 'default' : 'secondary'}>
                        {backendInfo.integrations.realtimeEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">Storage</h3>
                        <p className="text-sm text-muted-foreground">File storage service</p>
                      </div>
                      <Badge variant={backendInfo.integrations.storageEnabled ? 'default' : 'secondary'}>
                        {backendInfo.integrations.storageEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-semibold">Last Updated:</span>{' '}
                      {new Date(backendInfo.timestamp).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-semibold">Total Tables:</span>{' '}
                      {backendInfo.database.tables.length}
                    </p>
                    <p>
                      <span className="font-semibold">Total Functions:</span>{' '}
                      {backendInfo.database.functions.length}
                    </p>
                    <p>
                      <span className="font-semibold">Edge Functions:</span>{' '}
                      {backendInfo.edgeFunctions.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;