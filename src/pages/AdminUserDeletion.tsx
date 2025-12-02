import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  phone_number: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
}

interface DependencyCheck {
  activeP2POrders: number;
  activeMarketplaceOrders: number;
  balances: Array<{ token: string; balance: string; chain_id: number }>;
  hasKYC: boolean;
  virtualCards: number;
  stakingPositions: number;
}

const AdminUserDeletion = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [dependencies, setDependencies] = useState<DependencyCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const searchUser = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a phone number or email");
      return;
    }

    setIsLoading(true);
    setSearchedUser(null);
    setDependencies(null);

    try {
      // Search by phone number or email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone_number, display_name, email, created_at')
        .or(`phone_number.eq.${searchQuery},email.eq.${searchQuery}`)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("User not found");
        return;
      }

      setSearchedUser(data);
      await checkDependencies(data.id);
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Failed to search for user");
    } finally {
      setIsLoading(false);
    }
  };

  const checkDependencies = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId, force: false }
      });

      if (error) {
        // If error contains dependencies, extract them
        if (error.message) {
          try {
            const errorData = JSON.parse(error.message);
            if (errorData.dependencies) {
              setDependencies(errorData.dependencies);
            }
          } catch (e) {
            console.error('Failed to parse error:', e);
          }
        }
      }

      if (data?.dependencies) {
        setDependencies(data.dependencies);
      }
    } catch (error) {
      console.error('Dependency check error:', error);
    }
  };

  const handleDelete = async () => {
    if (!searchedUser) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { 
          userId: searchedUser.id,
          force: forceDelete
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`User ${searchedUser.display_name || searchedUser.phone_number} deleted successfully`);
        setSearchedUser(null);
        setDependencies(null);
        setSearchQuery("");
        setShowDeleteDialog(false);
        setForceDelete(false);
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      
      // Try to parse error message
      let errorMessage = "Failed to delete user";
      if (error.message) {
        try {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.error || errorMessage;
          
          if (errorData.requiresForce) {
            toast.error("User has non-zero balances. Use force delete to proceed.");
            setForceDelete(true);
            return;
          }
        } catch (e) {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const canDelete = dependencies && 
    dependencies.activeP2POrders === 0 && 
    dependencies.activeMarketplaceOrders === 0;

  const hasBalances = dependencies && dependencies.balances.length > 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Deletion Tool</h1>
            <p className="text-muted-foreground">
              Safely delete user accounts with dependency checking
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search User</CardTitle>
            <CardDescription>
              Search by phone number (E.164 format) or email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="+1234567890 or user@example.com"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              />
              <Button onClick={searchUser} disabled={isLoading}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {searchedUser && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">User ID</p>
                    <p className="font-mono text-sm">{searchedUser.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{searchedUser.phone_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Display Name</p>
                    <p className="font-medium">{searchedUser.display_name || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{searchedUser.email || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Created</p>
                    <p className="font-medium">
                      {new Date(searchedUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {dependencies && (
              <Card>
                <CardHeader>
                  <CardTitle>Dependency Check</CardTitle>
                  <CardDescription>
                    Review user data and dependencies before deletion
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active P2P Orders</span>
                      <Badge variant={dependencies.activeP2POrders > 0 ? "destructive" : "default"}>
                        {dependencies.activeP2POrders > 0 ? (
                          <XCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {dependencies.activeP2POrders}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Marketplace Orders</span>
                      <Badge variant={dependencies.activeMarketplaceOrders > 0 ? "destructive" : "default"}>
                        {dependencies.activeMarketplaceOrders > 0 ? (
                          <XCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {dependencies.activeMarketplaceOrders}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-sm">KYC Verification</span>
                      <Badge variant="secondary">
                        {dependencies.hasKYC ? 'Yes' : 'No'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Virtual Cards</span>
                      <Badge variant="secondary">{dependencies.virtualCards}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Staking Positions</span>
                      <Badge variant="secondary">{dependencies.stakingPositions}</Badge>
                    </div>

                    {dependencies.balances.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-2">Wallet Balances</p>
                          <div className="space-y-2">
                            {dependencies.balances.map((balance, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {balance.token} (Chain {balance.chain_id})
                                </span>
                                <span className="font-mono">{balance.balance}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {!canDelete && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Cannot delete user: Active orders must be completed or cancelled first.
                      </AlertDescription>
                    </Alert>
                  )}

                  {canDelete && hasBalances && !forceDelete && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        User has non-zero balances. Force delete will be required.
                      </AlertDescription>
                    </Alert>
                  )}

                  {canDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete User Account
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This action cannot be undone. This will permanently delete the account for:
              </p>
              <p className="font-semibold">
                {searchedUser?.display_name || searchedUser?.phone_number}
              </p>
              {hasBalances && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    User has non-zero balances that will be lost!
                  </AlertDescription>
                </Alert>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hasBalances ? 'Force Delete' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDeletion;
