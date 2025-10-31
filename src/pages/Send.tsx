import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send as SendIcon, Zap, ExternalLink, QrCode, Check, AlertCircle } from "lucide-react";
import { validateE164PhoneNumber, formatPhoneNumber, autoCorrectPhoneNumber, COUNTRY_PHONE_RULES } from "@/utils/phoneValidation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";
import { use2FAGuard } from "@/hooks/use2FAGuard";
import { QRScanner } from "@/components/QRScanner";
import { ContactSelector } from "@/components/ContactSelector";
import { ChainSelector } from "@/components/ChainSelector";
import { TokenSelector } from "@/components/TokenSelector";
import { DEFAULT_CHAIN } from "@/utils/blockchain";

const Send = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledContact = location.state?.contact;
  const { TwoFactorDialog, requireVerification, isVerifying } = use2FAGuard();

  const [transferType, setTransferType] = useState<"internal" | "external">(
    prefilledContact?.isFinMoUser ? "internal" : "external"
  );
  const [phoneNumber, setPhoneNumber] = useState(prefilledContact?.phone || "");
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [chainId, setChainId] = useState(DEFAULT_CHAIN.chainId);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedContactName, setSelectedContactName] = useState(prefilledContact?.name || "");
  const [phoneValidationError, setPhoneValidationError] = useState<string>("");

  // Validate phone number whenever it changes
  useEffect(() => {
    if (transferType === "internal" && phoneNumber) {
      const corrected = autoCorrectPhoneNumber(phoneNumber);
      const validation = validateE164PhoneNumber(corrected);
      setPhoneValidationError(validation.valid ? "" : validation.error || "Invalid phone number");
    } else {
      setPhoneValidationError("");
    }
  }, [phoneNumber, transferType]);

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
      .maybeSingle();
    
    setProfile(profileData);
  };

  const handleQRScan = (data: { phone?: string; wallet?: string; isFinMo: boolean }) => {
    if (data.isFinMo && data.phone) {
      setTransferType("internal");
      setPhoneNumber(data.phone);
      setSelectedContactName("");
      toast.success("FinMo wallet detected - recipient loaded!");
    } else if (data.wallet) {
      setTransferType("external");
      setWalletAddress(data.wallet);
      setSelectedContactName("");
      toast.success("Wallet address loaded!");
    }
  };

  const handleContactSelect = (contact: { name: string; phone: string; isFinMoUser: boolean; walletAddress?: string }) => {
    setSelectedContactName(contact.name);
    if (contact.isFinMoUser) {
      setTransferType("internal");
      setPhoneNumber(contact.phone);
      setWalletAddress("");
    } else {
      // External contact - user can choose to send on-chain if they have wallet
      setPhoneNumber(contact.phone);
      if (contact.walletAddress) {
        setWalletAddress(contact.walletAddress);
      }
    }
  };

  const handleSend = async () => {
    if (!profile) return;

    // Validate phone number for internal transfers
    if (transferType === "internal") {
      const corrected = autoCorrectPhoneNumber(phoneNumber);
      const validation = validateE164PhoneNumber(corrected);
      if (!validation.valid) {
        toast.error(validation.error || "Invalid phone number");
        return;
      }
    }
    
    // Wrap the entire send logic in 2FA verification
    await requireVerification("require_on_send", async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Check KYC status for external transfers (withdrawals)
        if (transferType === 'external') {
          const { data: kycData } = await supabase
            .from('kyc_verifications')
            .select('status')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!kycData || kycData.status !== 'approved') {
            toast.error('KYC verification required for withdrawals. Please complete identity verification to enable blockchain withdrawals.');
            navigate('/kyc-verification');
            setLoading(false);
            return;
          }
        }

        // Route to appropriate endpoint based on transfer type
        const endpoint = transferType === 'internal' ? 'process-transaction' : 'blockchain-withdraw';
        
        // Normalize phone number before sending
        const normalizedPhone = transferType === 'internal' ? autoCorrectPhoneNumber(phoneNumber) : undefined;
        
        const { data, error } = await supabase.functions.invoke(endpoint, {
          body: {
            recipient_phone: normalizedPhone,
            recipient_wallet: transferType === 'external' ? walletAddress : undefined,
            amount: parseFloat(amount),
            token: token,
            transaction_type: transferType,
            chain_id: transferType === 'external' ? chainId : undefined,
          },
        });

        if (error) throw error;

        if (transferType === 'external' && data.explorerUrl) {
          toast.success(
            <div>
              <p>{data.message}</p>
              <a 
                href={data.explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
              >
                View on Explorer
              </a>
            </div>
          );
        } else {
          toast.success(data.message || 'Transaction completed!');
        }

        // Reward points are now handled in the backend
        navigate("/dashboard");
      } catch (error: any) {
        console.error('Transaction error:', error);
        toast.error(error.message || "Unable to complete transaction. Please verify you have sufficient balance and try again. If the issue persists, contact support.");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 flex-shrink-0"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Send Money</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
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
                  <div className="flex items-center justify-between gap-2">
                    <Label>Recipient Phone Number</Label>
                    <div className="flex gap-2">
                      <ContactSelector 
                        onSelectContact={handleContactSelect}
                        selectedPhone={phoneNumber}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowScanner(true)}
                        className="gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        Scan QR
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="relative">
                      <Input
                        type="tel"
                        inputMode="numeric"
                        placeholder="+234 801 234 5678"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          setSelectedContactName("");
                        }}
                        className={`pr-10 ${!phoneValidationError && phoneNumber ? 'border-success' : phoneValidationError ? 'border-destructive' : ''}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {!phoneValidationError && phoneNumber ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : phoneValidationError ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : null}
                      </div>
                    </div>
                    {phoneValidationError && (
                      <p className="text-xs text-destructive">{phoneValidationError}</p>
                    )}
                    {selectedContactName && (
                      <p className="text-sm text-muted-foreground">
                        Sending to: <span className="font-semibold">{selectedContactName}</span>
                      </p>
                    )}
                  </div>
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

                <ChainSelector value={chainId} onChange={setChainId} />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Wallet Address</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowScanner(true)}
                      className="gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      Scan QR
                    </Button>
                  </div>
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

        {/* Token and Amount Selection */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-6 space-y-4">
            {transferType === "external" && (
              <TokenSelector chainId={chainId} value={token} onChange={setToken} />
            )}
            
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
                {transferType === "internal" && (
                  <Select value={token} onValueChange={setToken}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="MATIC">MATIC</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
          disabled={!amount || loading || isVerifying || (transferType === "internal" ? (!phoneNumber || !!phoneValidationError) : !walletAddress)}
          className="w-full h-14 text-lg bg-gradient-success hover:opacity-90"
        >
          {loading || isVerifying ? (
            isVerifying ? "Verifying 2FA..." : "Processing..."
          ) : (
            <>
              <SendIcon className="w-5 h-5 mr-2" />
              {transferType === "internal" ? "Send Instantly" : "Send to Blockchain"}
            </>
          )}
        </Button>
      </div>
      
      <QRScanner 
        open={showScanner} 
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
      <TwoFactorDialog />
      <MobileNav />
    </div>
  );
};

export default Send;
