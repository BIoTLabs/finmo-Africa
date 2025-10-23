import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Smartphone, Lock, ChevronDown, Zap, Users, CreditCard, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import finmoLogo from "@/assets/finmo-logo.png";
import { supabase } from "@/integrations/supabase/client";
import TwoFactorVerify from "@/components/TwoFactorVerify";
import { use2FA } from "@/hooks/use2FA";
import { use2FAPreferences } from "@/hooks/use2FAPreferences";

// African country codes
const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+256", country: "Uganda", flag: "🇺🇬" },
  { code: "+255", country: "Tanzania", flag: "🇹🇿" },
];

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [countryCode, setCountryCode] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [show2FAVerify, setShow2FAVerify] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [pending2FASession, setPending2FASession] = useState(false);
  const { challengeMFA, verifyChallenge } = use2FA();
  const { checkIfRequired } = use2FAPreferences();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's an error or no session, clear any stale data and show login
        if (error || !session) {
          await supabase.auth.signOut();
          setChecking(false);
          return;
        }
        
        // Verify the user actually exists by checking if we can get their data
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // User doesn't exist (deleted) but has a stale token - sign out
          console.error("User not found, clearing session:", userError);
          await supabase.auth.signOut();
          setChecking(false);
          return;
        }
        
        // Valid session and user exists - redirect to dashboard
        navigate("/dashboard", { replace: true });
      } catch (error) {
        console.error("Session check error:", error);
        await supabase.auth.signOut();
        setChecking(false);
      }
    };
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        setChecking(false);
        setShow2FAVerify(false);
        setPendingFactorId(null);
        setPending2FASession(false);
      } else if (session && event === 'SIGNED_IN') {
        // If we're waiting for 2FA, don't navigate
        if (pending2FASession) {
          console.log("Signed in but waiting for 2FA verification");
          return;
        }
        // Otherwise navigate to dashboard
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phoneNumber}`;

      if (isLogin) {
        // CRITICAL: Set pending2FASession BEFORE signInWithPassword to prevent race condition
        // Check if 2FA would be required before authentication
        const { data: { user: checkUser } } = await supabase.auth.getUser();
        
        // Pre-check if this user would need 2FA (we'll verify after login)
        setPending2FASession(true);
        
        // Now perform the actual sign in
        const { data: tempSession, error: signInError } = await supabase.auth.signInWithPassword({
          email: `${fullPhone}@finmo.app`,
          password,
        });

        if (signInError || !tempSession.session) {
          setPending2FASession(false);
          throw signInError || new Error("Login failed");
        }
        
        console.log("Login successful, checking 2FA requirements...");
        
        // MANDATORY 2FA CHECK - All users must have 2FA enabled to login
        const { data: factors } = await supabase.auth.mfa.listFactors();
        console.log("MFA factors:", factors);
        
        if (!factors || !factors.totp || factors.totp.length === 0) {
          // User doesn't have 2FA set up - force them to set it up
          setPending2FASession(false);
          await supabase.auth.signOut();
          toast.error("Two-Factor Authentication is required. Please contact support to enable 2FA for your account.");
          setLoading(false);
          return;
        }
        
        const verifiedFactor = factors.totp.find(f => f.status === "verified");
        
        if (!verifiedFactor) {
          // User has 2FA but it's not verified
          setPending2FASession(false);
          await supabase.auth.signOut();
          toast.error("Two-Factor Authentication setup is incomplete. Please contact support.");
          setLoading(false);
          return;
        }
        
        // User has verified 2FA - require verification on every login
        console.log("2FA is mandatory and enabled, showing verification dialog");
        setPendingFactorId(verifiedFactor.id);
        setShow2FAVerify(true);
        setLoading(false);
        return; // Don't navigate yet - wait for 2FA verification
      } else {
        // Sign up without OTP verification
        const { data, error } = await supabase.auth.signUp({
          email: `${fullPhone}@finmo.app`,
          password,
          options: {
            data: {
              phone_number: fullPhone,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`
          },
        });

        if (error) {
          console.error("Signup error:", error);
          throw error;
        }
        
        // Auto-confirm is enabled, so directly navigate to dashboard
        toast.success("Account created successfully!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error("We couldn't sign you in. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (code: string): Promise<boolean> => {
    if (!pendingFactorId) return false;
    
    const success = await verifyChallenge(pendingFactorId, code);
    if (success) {
      setPending2FASession(false);
      setShow2FAVerify(false);
      setPendingFactorId(null);
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
    return success;
  };

  const handle2FACancel = async () => {
    setShow2FAVerify(false);
    setPendingFactorId(null);
    setPending2FASession(false);
    await supabase.auth.signOut();
    toast.info("Login cancelled");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="text-primary-foreground text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-glow flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        
        {/* Logo and Welcome */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-finmo-lg animate-scale-in">
            <img src={finmoLogo} alt="FinMo" className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">FinMo</h1>
            <p className="text-white/80 text-sm mt-1">Send money instantly across Africa</p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="shadow-finmo-lg border-0 overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">
              {isLogin ? "Welcome Back" : "Get Started"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin ? "Sign in to your wallet" : "Create your secure wallet"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="w-4 h-4" />
                  Phone Number
                </Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="8012345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    className="flex-1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11 text-base font-semibold"
                disabled={loading}
              >
                {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
              </Button>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </Button>
                
                {isLogin && (
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => navigate("/forgot-password")}
                  >
                    Forgot your password?
                  </Button>
                )}
              </div>
            </form>

            {/* Learn More Section */}
            <Collapsible open={showInfo} onOpenChange={setShowInfo} className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  type="button"
                >
                  <span className="text-sm font-medium">Learn more about FinMo</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showInfo ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-2 animate-accordion-down">
                {/* Quick Features */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg">
                    <Zap className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs font-medium">Instant Transfers</p>
                    <p className="text-xs text-muted-foreground mt-1">Send money in seconds</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-success/5 to-success/10 rounded-lg">
                    <Users className="w-5 h-5 text-success mb-2" />
                    <p className="text-xs font-medium">Phone Contacts</p>
                    <p className="text-xs text-muted-foreground mt-1">No wallet addresses</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-accent/5 to-accent/10 rounded-lg">
                    <ArrowRightLeft className="w-5 h-5 text-accent-foreground mb-2" />
                    <p className="text-xs font-medium">P2P Trading</p>
                    <p className="text-xs text-muted-foreground mt-1">Buy & sell crypto</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-secondary/5 to-secondary/10 rounded-lg">
                    <CreditCard className="w-5 h-5 text-secondary-foreground mb-2" />
                    <p className="text-xs font-medium">Virtual Cards</p>
                    <p className="text-xs text-muted-foreground mt-1">Shop online safely</p>
                  </div>
                </div>

                {/* What is FinMo */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">What is FinMo?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    FinMo is a mobile-first cryptocurrency wallet designed for Africa. 
                    Send USDC and MATIC to anyone using just their phone number. 
                    Zero fees for FinMo-to-FinMo transfers, with secure blockchain technology.
                  </p>
                </div>

                {/* Getting Started */}
                <div className="p-4 border rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">Getting Started</h3>
                  <ol className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">1</span>
                      <span>Sign up with your phone number</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">2</span>
                      <span>Get your wallet address automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">3</span>
                      <span>Add funds and start sending money</span>
                    </li>
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs">
          Powered by blockchain technology • Secure & Fast
        </p>

        <TwoFactorVerify
          open={show2FAVerify}
          onVerify={handle2FAVerify}
          onCancel={handle2FACancel}
        />
      </div>
    </div>
  );
};

export default Auth;
