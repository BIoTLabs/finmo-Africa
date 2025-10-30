import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Smartphone, ChevronDown, Zap, Users, CreditCard, ArrowRightLeft, Mail, Check, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import finmoLogo from "@/assets/finmo-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";

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
  const [useOTP, setUseOTP] = useState(false);
  const [countryCode, setCountryCode] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const phoneValidation = usePhoneValidation(countryCode, phoneNumber);

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
      } else if (session && event === 'SIGNED_IN') {
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
      // Validate phone number
      if (!phoneValidation.isValid) {
        toast.error(phoneValidation.error || "Invalid phone number");
        setLoading(false);
        return;
      }

      const fullPhone = phoneValidation.normalized || `${countryCode}${phoneNumber}`;
      
      if (isLogin) {
        if (useOTP) {
          // Login with OTP - send verification code (backend validates user exists)
          console.log("Attempting OTP login - sending code to:", fullPhone);

          // Send OTP (backend will validate user exists)
          const { data: otpData, error: otpError } = await supabase.functions.invoke('verify-phone-otp', {
            body: { phoneNumber: fullPhone, isLogin: true }
          });

          if (otpError || !otpData.success) {
            console.error("OTP send error:", otpError);
            toast.error(otpData?.error || "Failed to send verification code");
            setLoading(false);
            return;
          }

          toast.success("Verification code sent to your phone");
          navigate("/verify-phone", { 
            state: { 
              phoneNumber: fullPhone, 
              isLogin: true,
              useOTP: true
            } 
          });
        } else {
          // Login with password - use backend to get email
          if (!password || password.length < 6) {
            toast.error("Please enter your password");
            setLoading(false);
            return;
          }

          console.log("Attempting password login with phone:", fullPhone);
          
          // Get user's email via backend function (bypasses RLS)
          const { data: emailData, error: emailError } = await supabase.functions.invoke('get-user-email-by-phone', {
            body: { phoneNumber: fullPhone }
          });

          if (emailError || !emailData.success) {
            console.error("Email lookup error:", emailError);
            toast.error(emailData?.error || "Account not found. Please check your phone number or sign up.");
            setLoading(false);
            return;
          }

          console.log("Found email for phone, attempting sign in with:", emailData.email);

          // Sign in with email and password
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailData.email,
            password: password,
          });

          if (signInError) {
            console.error("Sign in error:", signInError);
            console.error("Error code:", signInError.status);
            console.error("Error message:", signInError.message);
            
            if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("invalid_credentials")) {
              toast.error("Invalid password. Try 'Forgot Password?' or use OTP login instead.");
            } else {
              toast.error(signInError.message);
            }
            setLoading(false);
            return;
          }

          if (signInData.session) {
            toast.success("Welcome back!");
            navigate("/dashboard");
          }
        }
      } else {
        // Signup flow - validate email and send OTP
        if (!email || !email.includes('@')) {
          toast.error("Please enter a valid email address for account recovery");
          setLoading(false);
          return;
        }

        if (!password || password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        console.log("Starting signup - sending OTP to:", fullPhone);
        
        // Send OTP to phone
        const { data: otpData, error: otpError } = await supabase.functions.invoke('verify-phone-otp', {
          body: { phoneNumber: fullPhone }
        });

        if (otpError || !otpData.success) {
          console.error("OTP send error:", otpError);
          toast.error(otpData?.error || "Failed to send verification code");
          setLoading(false);
          return;
        }

        toast.success("Verification code sent to your phone");
        navigate("/verify-phone", { 
          state: { 
            phoneNumber: fullPhone, 
            email, 
            password, 
            isLogin: false,
            useOTP: false
          } 
        });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
                  <div className="flex-1 space-y-1">
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        placeholder={phoneValidation.rules.example.substring(countryCode.length)}
                        value={phoneValidation.formatted}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, "");
                          if (cleaned.length <= phoneValidation.rules.digits) {
                            setPhoneNumber(cleaned);
                          }
                        }}
                        maxLength={phoneValidation.rules.digits + Math.floor(phoneValidation.rules.digits / 3)}
                        className={`pr-10 ${phoneValidation.isValid ? 'border-success' : phoneNumber && !phoneValidation.isValid ? 'border-destructive' : ''}`}
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {phoneValidation.isValid ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : phoneNumber && !phoneValidation.isValid ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Format: {phoneValidation.rules.format}
                      </span>
                      <span className={`font-medium ${phoneValidation.isValid ? 'text-success' : 'text-muted-foreground'}`}>
                        {phoneValidation.progress}
                      </span>
                    </div>
                    {phoneNumber && !phoneValidation.isValid && phoneValidation.error && (
                      <p className="text-xs text-destructive">{phoneValidation.error}</p>
                    )}
                  </div>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="w-4 h-4" />
                    Email Address (for recovery)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for password reset and account recovery
                  </p>
                </div>
              )}

              {(isLogin && !useOTP) || !isLogin ? (
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
              ) : null}

              {isLogin && (
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-primary p-0 h-auto"
                    onClick={() => {
                      setUseOTP(!useOTP);
                      setPassword("");
                    }}
                  >
                    {useOTP ? "Use Password Instead" : "Use OTP Instead"}
                  </Button>
                  {!useOTP && (
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-muted-foreground p-0 h-auto"
                      onClick={() => navigate("/forgot-password")}
                    >
                      Forgot Password?
                    </Button>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11 text-base font-semibold"
                disabled={loading || !phoneValidation.isValid}
              >
                {loading ? (
                  isLogin ? (useOTP ? "Sending code..." : "Signing in...") : "Sending code..."
                ) : (
                  isLogin ? (useOTP ? "Send Login Code" : "Sign In") : "Create Account"
                )}
              </Button>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setEmail("");
                    setPassword("");
                    setUseOTP(false);
                  }}
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </Button>
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
      </div>
    </div>
  );
};

export default Auth;
