import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Search, Download } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_user_id: string | null;
  target_user_phone: string | null;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      fetchLogs();
    }
  }, [adminLoading, isAdmin]);

  if (adminLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq('action_type', actionFilter);
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        query = query.lte('created_at', new Date(dateTo).toISOString());
      }

      if (searchQuery) {
        query = query.or(`target_user_phone.ilike.%${searchQuery}%,target_user_id.eq.${searchQuery}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Fetch logs error:', error);
      toast.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'Admin ID', 'Target User', 'Details'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.action_type,
        log.admin_id,
        log.target_user_phone || log.target_user_id || 'N/A',
        JSON.stringify(log.metadata).replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionBadgeColor = (action: string): "default" | "destructive" | "secondary" => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('suspend')) return 'secondary';
    return 'default';
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Complete record of all administrative actions
              </CardDescription>
            </div>
            <Button onClick={exportLogs} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search by phone or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="user_deleted">User Deleted</SelectItem>
                <SelectItem value="user_deleted_forced">User Deleted (Forced)</SelectItem>
                <SelectItem value="user_suspended">User Suspended</SelectItem>
                <SelectItem value="user_suspended_temporary">User Suspended (Temporary)</SelectItem>
                <SelectItem value="user_unsuspended">User Unsuspended</SelectItem>
                <SelectItem value="bulk_operation_suspend">Bulk Suspend</SelectItem>
                <SelectItem value="bulk_operation_unsuspend">Bulk Unsuspend</SelectItem>
                <SelectItem value="bulk_operation_delete">Bulk Delete</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
            />
          </div>

          <Button onClick={fetchLogs} disabled={loading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>

          {/* Logs List */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionBadgeColor(log.action_type)}>
                          {log.action_type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="font-medium">Admin ID:</span> {log.admin_id}
                        </p>
                        {log.target_user_phone && (
                          <p>
                            <span className="font-medium">Target User:</span> {log.target_user_phone}
                          </p>
                        )}
                        {log.target_user_id && (
                          <p>
                            <span className="font-medium">User ID:</span> {log.target_user_id}
                          </p>
                        )}
                        {log.ip_address && (
                          <p>
                            <span className="font-medium">IP:</span> {log.ip_address}
                          </p>
                        )}
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium cursor-pointer text-primary">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}