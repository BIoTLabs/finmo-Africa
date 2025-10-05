import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

interface PaymentMethod {
  id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  bank_name?: string;
  country_code: string;
  is_verified: boolean;
}

const PaymentMethods = () => {
  const navigate = useNavigate();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    method_type: "bank_transfer",
    account_name: "",
    account_number: "",
    bank_name: "",
    country_code: "NG",
  });

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast.error("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMethod = async () => {
    if (!formData.account_name || !formData.account_number) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("payment_methods").insert({
        user_id: user.id,
        method_type: formData.method_type,
        account_name: formData.account_name,
        account_number: formData.account_number,
        bank_name: formData.bank_name || null,
        country_code: formData.country_code,
      });

      if (error) throw error;

      toast.success("Payment method added successfully");
      setShowAddDialog(false);
      setFormData({
        method_type: "bank_transfer",
        account_name: "",
        account_number: "",
        bank_name: "",
        country_code: "NG",
      });
      fetchPaymentMethods();
    } catch (error: any) {
      console.error("Error adding payment method:", error);
      toast.error(error.message || "Failed to add payment method");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Payment method deleted");
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast.error("Failed to delete payment method");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Payment Methods</h1>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payment Method</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Method Type</Label>
                  <Select
                    value={formData.method_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, method_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={formData.country_code}
                    onValueChange={(value) =>
                      setFormData({ ...formData, country_code: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NG">Nigeria</SelectItem>
                      <SelectItem value="KE">Kenya</SelectItem>
                      <SelectItem value="GH">Ghana</SelectItem>
                      <SelectItem value="ZA">South Africa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    placeholder="1234567890"
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, account_number: e.target.value })
                    }
                  />
                </div>

                {formData.method_type === "bank_transfer" && (
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      placeholder="First Bank"
                      value={formData.bank_name}
                      onChange={(e) =>
                        setFormData({ ...formData, bank_name: e.target.value })
                      }
                    />
                  </div>
                )}

                <Button onClick={handleAddMethod} className="w-full">
                  Add Payment Method
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : methods.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No payment methods added</p>
            <p className="text-sm text-muted-foreground">
              Add payment methods to trade on P2P marketplace
            </p>
          </div>
        ) : (
          methods.map((method) => (
            <Card key={method.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="capitalize">{method.method_type.replace("_", " ")}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(method.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Name</span>
                  <span className="font-semibold">{method.account_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Number</span>
                  <span className="font-mono">{method.account_number}</span>
                </div>
                {method.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Bank</span>
                    <span>{method.bank_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default PaymentMethods;
