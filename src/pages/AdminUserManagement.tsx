import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Search, UserMinus, UserCheck, Trash2, Clock } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  phone_number: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspension_expires_at: string | null;
  suspended_at: string | null;
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [bulkOperation, setBulkOperation] = useState<"suspend" | "unsuspend" | "delete" | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  if (adminLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, phone_number, display_name, email, created_at, is_suspended, suspension_reason, suspension_expires_at, suspended_at')
        .or(`phone_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter === "active") {
        query = query.eq('is_suspended', false);
      } else if (statusFilter === "suspended") {
        query = query.eq('is_suspended', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
      setSelectedUsers(new Set());
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error("Failed to search users");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleBulkOperation = async () => {
    if (selectedUsers.size === 0) {
      toast.error("No users selected");
      return;
    }

    if (bulkOperation === "suspend" && !suspensionReason.trim()) {
      toast.error("Please provide a suspension reason");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-bulk-user-operations', {
        body: {
          operation: bulkOperation,
          userIds: Array.from(selectedUsers),
          reason: suspensionReason || undefined,
          expiresAt: expiresAt || undefined,
          ipAddress: window.location.hostname,
          userAgent: navigator.userAgent
        }
      });

      if (error) throw error;

      const summary = data.summary;
      toast.success(`Operation completed: ${summary.successful} successful, ${summary.failed} failed`);
      
      if (data.results.failed.length > 0) {
        console.log('Failed operations:', data.results.failed);
      }

      // Refresh the user list
      await searchUsers();
      setSelectedUsers(new Set());
      setBulkOperation(null);
      setSuspensionReason("");
      setExpiresAt("");
    } catch (error: any) {
      console.error('Bulk operation error:', error);
      toast.error(error.message || "Failed to complete bulk operation");
    } finally {
      setLoading(false);
    }
  };

  const handleSingleAction = async (userId: string, action: "suspend" | "unsuspend") => {
    if (action === "suspend" && !suspensionReason.trim()) {
      toast.error("Please provide a suspension reason");
      return;
    }

    setLoading(true);
    try {
      const endpoint = action === "suspend" ? 'admin-suspend-user' : 'admin-unsuspend-user';
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: {
          userId,
          reason: suspensionReason || undefined,
          expiresAt: expiresAt || undefined,
          ipAddress: window.location.hostname,
          userAgent: navigator.userAgent
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(`User ${action === "suspend" ? "suspended" : "unsuspended"} successfully`);
      await searchUsers();
      setSuspensionReason("");
      setExpiresAt("");
    } catch (error: any) {
      console.error('Action error:', error);
      toast.error(error.message || `Failed to ${action} user`);
    } finally {
      setLoading(false);
    }
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
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Search, manage, and perform bulk operations on user accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Section */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by phone, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="suspended">Suspended Only</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={searchUsers} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Bulk Actions */}
          {users.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Checkbox
                checked={selectedUsers.size === users.length && users.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedUsers.size} of {users.length} selected
              </span>
              {selectedUsers.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkOperation("suspend")}
                    disabled={loading}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Suspend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkOperation("unsuspend")}
                    disabled={loading}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Unsuspend
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkOperation("delete")}
                    disabled={loading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}

          {/* User List */}
          {users.length > 0 && (
            <div className="space-y-2">
              {users.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.display_name || user.phone_number}
                        </span>
                        {user.is_suspended && (
                          <Badge variant="destructive">Suspended</Badge>
                        )}
                        {user.suspension_expires_at && (
                          <Badge variant="outline">
                            <Clock className="mr-1 h-3 w-3" />
                            Until {format(new Date(user.suspension_expires_at), 'MMM d, yyyy')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {user.phone_number} • {user.email}
                      </p>
                      {user.is_suspended && user.suspension_reason && (
                        <p className="text-sm text-destructive">
                          Reason: {user.suspension_reason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {user.is_suspended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleAction(user.id, "unsuspend")}
                          disabled={loading}
                        >
                          Unsuspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUsers(new Set([user.id]));
                            setBulkOperation("suspend");
                          }}
                          disabled={loading}
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/user-deletion?userId=${user.id}`)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {users.length === 0 && searchQuery && !loading && (
            <p className="text-center text-muted-foreground py-8">
              No users found matching your search
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bulk Operation Dialog */}
      <AlertDialog open={bulkOperation !== null} onOpenChange={() => setBulkOperation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkOperation === "suspend" && "Suspend Users"}
              {bulkOperation === "unsuspend" && "Unsuspend Users"}
              {bulkOperation === "delete" && "Delete Users"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to {bulkOperation} {selectedUsers.size} user(s). This action affects:
              <ul className="list-disc list-inside mt-2 space-y-1">
                {Array.from(selectedUsers).slice(0, 5).map((id) => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <li key={id}>{user.display_name || user.phone_number}</li>
                  ) : null;
                })}
                {selectedUsers.size > 5 && (
                  <li>... and {selectedUsers.size - 5} more</li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {bulkOperation === "suspend" && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Reason (required)</label>
                <Textarea
                  placeholder="Enter suspension reason..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Expires At (optional)</label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for permanent suspension
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkOperation} disabled={loading}>
              {loading ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}