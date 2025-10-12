import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Fingerprint, Shield, Copy, LogOut, Eye, EyeOff, CreditCard, ChevronRight, FileText, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import TwoFactorPreferences from "@/components/TwoFactorPreferences";
import { use2FA } from "@/hooks/use2FA";

const Settings = () => {
  const navigate = useNavigate();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [enrollingBiometric, setEnrollingBiometric] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [addressVisible, setAddressVisible] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { unenrollMFA } = use2FA();

  useEffect(() => {
    checkAuth();
    check2FAStatus();
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

  const check2FAStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp.length > 0) {
        const hasVerified = factors.totp.some(f => f.status === "verified");
        setTwoFactorEnabled(hasVerified);
      }
    } catch (error) {
      console.error("Error checking 2FA status:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const copyAddress = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      toast.success("Wallet address copied!");
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      // Enabling biometric
      setEnrollingBiometric(true);
      try {
        // Check if biometrics are available
        if (!window.PublicKeyCredential) {
          toast.error("Biometric authentication not supported on this device");
          return;
        }

        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          toast.error("No biometric hardware detected");
          return;
        }

        // Simulate biometric enrollment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setBiometricEnabled(true);
        toast.success("Biometric authentication enabled");
      } catch (error) {
        console.error("Biometric enrollment error:", error);
        toast.error("Failed to enable biometric authentication");
      } finally {
        setEnrollingBiometric(false);
      }
    } else {
      setBiometricEnabled(false);
      toast.success("Biometric authentication disabled");
    }
  };

  const handleTwoFactorToggle = async (enabled: boolean) => {
    if (enabled) {
      // Show 2FA setup dialog
      setShow2FASetup(true);
    } else {
      // Disable 2FA
      try {
        await unenrollMFA();
        setTwoFactorEnabled(false);
      } catch (error) {
        // Error already handled in hook
      }
    }
  };

  const handle2FASuccess = () => {
    setTwoFactorEnabled(true);
    setShow2FASetup(false);
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 flex-shrink-0"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
        </div>

        {/* User Info Card */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-gradient-success rounded-full flex items-center justify-center text-primary-foreground font-bold text-2xl">
                {profile.phone_number?.slice(-4) || "FM"}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm opacity-90">Phone Number</p>
                <p className="text-lg font-bold">{profile.phone_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Wallet Address */}
        <Card className="shadow-finmo-md">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Wallet Address</Label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAddressVisible(!addressVisible)}
              >
                {addressVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-xs font-mono break-all">
                {addressVisible ? profile.wallet_address : "••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyAddress}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Security</h2>

          <Card className="shadow-finmo-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Biometric Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      Use fingerprint or Face ID
                    </p>
                  </div>
                </div>
                  <Switch
                    checked={biometricEnabled}
                    onCheckedChange={handleBiometricToggle}
                    disabled={enrollingBiometric}
                  />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-finmo-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      Extra security via authenticator app
                    </p>
                  </div>
                </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={handleTwoFactorToggle}
                  />
              </div>
            </CardContent>
          </Card>

          {twoFactorEnabled && <TwoFactorPreferences />}
        </div>

        {/* Account & Compliance */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Account & Compliance</h2>

          <Card className="shadow-finmo-md cursor-pointer" onClick={() => navigate("/kyc-verification")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">KYC Verification</p>
                    <p className="text-sm text-muted-foreground">
                      Verify your identity
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-finmo-md cursor-pointer" onClick={() => navigate("/account-statement")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Account Statement</p>
                    <p className="text-sm text-muted-foreground">
                      Download transaction history
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Payment & Trading</h2>

          <Card className="shadow-finmo-md cursor-pointer" onClick={() => navigate("/my-ads")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">My Ads</p>
                    <p className="text-sm text-muted-foreground">
                      Manage your listings
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-finmo-md cursor-pointer" onClick={() => navigate("/payment-methods")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Payment Methods</p>
                    <p className="text-sm text-muted-foreground">
                      Manage P2P payment options
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full h-12"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <TwoFactorSetup
        open={show2FASetup}
        onOpenChange={setShow2FASetup}
        onSuccess={handle2FASuccess}
      />

      <MobileNav />
    </div>
  );
};

export default Settings;
