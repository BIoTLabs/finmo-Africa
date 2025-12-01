import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"auth" | "confirm">("auth");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [authenticatedPhone, setAuthenticatedPhone] = useState("");

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || !password) {
      toast.error("Please enter phone number and password");
      return;
    }

    setLoading(true);

    try {
      // Call phone-password-login to authenticate
      const { data, error } = await supabase.functions.invoke('phone-password-login', {
        body: { phoneNumber, password },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error.message || "Authentication failed");
        return;
      }

      // Successfully authenticated
      setAuthenticatedPhone(phoneNumber);
      setStep("confirm");
      toast.success("Authenticated successfully");
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSuccess = async () => {
    // Sign out and redirect to auth page
    await supabase.auth.signOut();
    toast.success("Your account has been permanently deleted");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-finmo-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-6 h-6" />
              <CardTitle>Delete Account</CardTitle>
            </div>
            {step === "auth" && (
              <p className="text-sm text-muted-foreground">
                Please authenticate to proceed with account deletion
              </p>
            )}
          </CardHeader>

          <CardContent>
            {step === "auth" ? (
              <form onSubmit={handleAuthenticate} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/auth")}
                    disabled={loading}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Authenticating..." : "Continue"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    Authenticated as:
                  </p>
                  <p className="font-semibold">{authenticatedPhone}</p>
                </div>

                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-destructive-foreground">
                    Warning: This action cannot be undone
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• All your data will be permanently deleted</li>
                    <li>• Your wallet and balances will be lost</li>
                    <li>• Your transaction history will be anonymized</li>
                    <li>• All active orders must be completed first</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex-1"
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={handleDeleteSuccess}
        phoneNumber={authenticatedPhone}
      />
    </div>
  );
};

export default DeleteAccount;
