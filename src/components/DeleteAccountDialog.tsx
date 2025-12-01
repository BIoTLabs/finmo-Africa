import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  phoneNumber: string;
}

export const DeleteAccountDialog = ({
  open,
  onOpenChange,
  onSuccess,
  phoneNumber,
}: DeleteAccountDialogProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          phoneNumber,
          password,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error.message || "Failed to delete account");
        return;
      }

      toast.success("Account permanently deleted");
      onSuccess();
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-6 h-6" />
            <AlertDialogTitle>Delete Account Permanently</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-destructive-foreground">
                This action cannot be undone!
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• All your data will be permanently deleted</li>
                <li>• Your wallet and balances will be lost</li>
                <li>• Your transaction history will be anonymized</li>
                <li>• All active orders must be completed first</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="confirm-text" className="text-foreground">
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">
                  Enter your password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="mt-1"
                  disabled={loading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading || confirmText !== "DELETE" || !password}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
