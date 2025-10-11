import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

const RequestPayment = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sendMethod, setSendMethod] = useState<"email" | "sms">("email");
  const [formData, setFormData] = useState({
    recipient_email: "",
    recipient_phone: "",
    recipient_name: "",
    amount: "",
    token: "USDC",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sendMethod === "email" && !formData.recipient_email) {
      toast.error("Please enter recipient email");
      return;
    }

    if (sendMethod === "sms" && !formData.recipient_phone) {
      toast.error("Please enter recipient phone number");
      return;
    }

    if (!formData.amount) {
      toast.error("Please enter an amount");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get requester profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, phone_number")
        .eq("id", user.id)
        .single();

      const requesterName = profile?.display_name || profile?.phone_number || "A FinMo user";

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create payment request
      const { data: paymentRequest, error: createError } = await supabase
        .from("payment_requests")
        .insert({
          requester_id: user.id,
          recipient_email: formData.recipient_email,
          recipient_name: formData.recipient_name || null,
          amount: amount,
          token: formData.token,
          message: formData.message || null,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (createError) throw createError;

      // Send notification based on method
      if (sendMethod === "email") {
        const { error: emailError } = await supabase.functions.invoke('send-payment-request', {
          body: {
            payment_request_id: paymentRequest.id,
            recipient_email: formData.recipient_email,
            recipient_name: formData.recipient_name,
            requester_name: requesterName,
            amount: amount,
            token: formData.token,
            message: formData.message,
          },
        });

        if (emailError) {
          console.error('Email error:', emailError);
          toast.warning("Payment request created but email failed to send");
        } else {
          toast.success("Payment request sent via email!");
        }
      } else {
        const { error: smsError } = await supabase.functions.invoke('send-payment-request-sms', {
          body: {
            payment_request_id: paymentRequest.id,
            recipient_phone: formData.recipient_phone,
            recipient_name: formData.recipient_name,
            requester_name: requesterName,
            amount: amount,
            token: formData.token,
          },
        });

        if (smsError) {
          console.error('SMS error:', smsError);
          toast.warning("Payment request created but SMS failed to send");
        } else {
          toast.success("Payment request sent via SMS!");
        }
      }

      // Reset form
      setFormData({
        recipient_email: "",
        recipient_phone: "",
        recipient_name: "",
        amount: "",
        token: "USDC",
        message: "",
      });

      // Navigate to a requests list page or back
      setTimeout(() => navigate("/dashboard"), 1500);

    } catch (error: any) {
      console.error("Error creating payment request:", error);
      toast.error("We couldn't send your payment request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 w-9 h-9"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Request Payment</h1>
        </div>
        <p className="text-sm opacity-90">Send a payment link via email</p>
      </div>

      {/* Info Card */}
      <div className="p-4">
        <Card className="bg-info/10 border-info/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-info">How it works</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a payment link via email or SMS. Recipients can pay even without a FinMo account!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Method Selector */}
      <div className="px-4">
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-semibold mb-2 block">Send via</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sendMethod === "email" ? "default" : "outline"}
                onClick={() => setSendMethod("email")}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button
                type="button"
                variant={sendMethod === "sms" ? "default" : "outline"}
                onClick={() => setSendMethod("sms")}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
            <CardDescription>Who are you requesting payment from?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sendMethod === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="recipient_email">Recipient Email *</Label>
                <Input
                  id="recipient_email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.recipient_email}
                  onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="recipient_phone">Recipient Phone *</Label>
                <Input
                  id="recipient_phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.recipient_phone}
                  onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">Include country code (e.g., +1 for US)</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="recipient_name">Recipient Name (Optional)</Label>
              <Input
                id="recipient_name"
                placeholder="John Doe"
                value={formData.recipient_name}
                onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Select
                  value={formData.token}
                  onValueChange={(value) => setFormData({ ...formData, token: value })}
                >
                  <SelectTrigger id="token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="MATIC">MATIC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Payment for service rendered..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full bg-gradient-primary hover:opacity-90 h-12"
          disabled={loading}
        >
          {loading ? (
            "Sending..."
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Payment Request
            </>
          )}
        </Button>
      </form>

      <MobileNav />
    </div>
  );
};

export default RequestPayment;
