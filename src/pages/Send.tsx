import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send as SendIcon, Zap, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";

const Send = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledContact = location.state?.contact;

  const [transferType, setTransferType] = useState<"internal" | "external">(
    prefilledContact?.isFinMoUser ? "internal" : "external"
  );
  const [phoneNumber, setPhoneNumber] = useState(prefilledContact?.phone || "");
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    setProfile(profileData);
  };

  const handleSend = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to process transaction
      const { data, error } = await supabase.functions.invoke('process-transaction', {
        body: {
          recipient_phone: transferType === 'internal' ? phoneNumber : undefined,
          recipient_wallet: transferType === 'external' ? walletAddress : undefined,
          amount: parseFloat(amount),
          token: token,
          transaction_type: transferType,
        },
      });

      if (error) throw error;

      toast.success(data.message || 'Transaction completed!');
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Transaction error:', error);
      toast.error(error.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Send Money</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Transfer Type Selection */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6">
            <Tabs value={transferType} onValueChange={(v) => setTransferType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="internal" className="gap-2">
                  <Zap className="w-4 h-4" />
                  Instant (FinMo)
                </TabsTrigger>
                <TabsTrigger value="external" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  On-Chain
                </TabsTrigger>
              </TabsList>

              <TabsContent value="internal" className="space-y-4 mt-4">
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-success mt-0.5" />
                    <div>
                      <p className="font-semibold text-success">Instant Transfer</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Send to FinMo users using phone numbers. Zero fees, instant delivery.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Recipient Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+234 801 234 5678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="external" className="space-y-4 mt-4">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary">External Transfer</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Send to any wallet address on the blockchain. Standard network fees apply.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Wallet Address</Label>
                  <Input
                    type="text"
                    placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f8a9f1"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 text-2xl font-semibold"
                />
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="MATIC">MATIC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fee Information */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-semibold">
                  {transferType === "internal" ? (
                    <Badge className="bg-success text-success-foreground">$0.00</Badge>
                  ) : (
                    "~$0.02"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">You Send</span>
                <span className="font-bold text-lg">
                  {amount || "0.00"} {token}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!amount || loading || (transferType === "internal" ? !phoneNumber : !walletAddress)}
          className="w-full h-14 text-lg bg-gradient-success hover:opacity-90"
        >
          {loading ? (
            "Processing..."
          ) : (
            <>
              <SendIcon className="w-5 h-5 mr-2" />
              {transferType === "internal" ? "Send Instantly" : "Send to Blockchain"}
            </>
          )}
        </Button>
      </div>
      <MobileNav />
    </div>
  );
};

export default Send;
