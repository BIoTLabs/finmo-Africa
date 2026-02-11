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
import { NetworkAccessDialog } from "@/components/NetworkAccessDialog";
import { extractOTPError, getOTPErrorMessage } from "@/utils/errorMessages";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";

// Fallback country codes (used while loading from database)
const FALLBACK_COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+256", country: "Uganda", flag: "🇺🇬" },
  { code: "+255", country: "Tanzania", flag: "🇹🇿" },
];

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

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
  const [countryCodes, setCountryCodes] = useState<CountryCode[]>(FALLBACK_COUNTRY_CODES);
  const phoneValidation = usePhoneValidation(countryCode, phoneNumber);

  // Fetch enabled countries from database
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const { data, error } = await supabase
          .from('supported_countries')
          .select('country_code, country_name, flag_emoji, sort_order')
          .eq('is_enabled', true)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('Error fetching countries:', error);
          return;
        }

        if (data && data.length > 0) {
          const formattedCountries = data.map(c => ({
            code: c.country_code,
            country: c.country_name,
            flag: c.flag_emoji
          }));
          setCountryCodes(formattedCountries);
          
          // Set default to first enabled country if current selection is not available
          if (!formattedCountries.some(c => c.code === countryCode)) {
            setCountryCode(formattedCountries[0].code);
          }
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };

    fetchCountries();
  }, []);

  // Timeout protection for loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (checking) {
        console.warn("Session check timed out, showing login form");
        setChecking(false);
      }
    }, 3000); // 3 second max wait
    
    return () => clearTimeout(timeout);
  }, [checking]);

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's an error or no session, just show login form
        if (error || !session) {
          setChecking(false);
          return;
        }
        
        // Valid session exists - redirect to dashboard
        // Only verify user if we have a session (reduces unnecessary API calls)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // User doesn't exist (deleted) but has a stale token - sign out
          console.error("User not found, clearing session:", userError);
          await supabase.auth.signOut();
          setChecking(false);
          return;
        }
        
        navigate("/dashboard", { replace: true });
      } catch (error) {
        console.error("Session check error:", error);
        setChecking(false);
      }
    };
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
            const errorData = extractOTPError(otpData, otpError);
            const errorMessage = getOTPErrorMessage(errorData);
            toast.error(errorMessage, { duration: errorData.errorCode === 'RATE_LIMITED' ? 6000 : 4000 });
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
          // Login with password - use secure phone-password login endpoint
          if (!password || password.length < 6) {
            toast.error("Please enter your password");
            setLoading(false);
            return;
          }

          console.log("Attempting password login with phone:", fullPhone);
          
          // Use secure server-side login that doesn't expose email/userId
          const { data: loginData, error: loginError } = await supabase.functions.invoke(
            'phone-password-login',
            {
              body: { 
                phoneNumber: fullPhone,
                password: password,
                ipAddress: window.location.hostname
              }
            }
          );

          if (loginError || !loginData?.success) {
            console.error("Login error:", loginError);
            const errorMessage = loginData?.message || "Invalid phone number or password";
            toast.error(errorMessage);
            setLoading(false);
            return;
          }

          // Set the session from the response
          if (loginData.session) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: loginData.session.access_token,
              refresh_token: loginData.session.refresh_token,
            });

            if (sessionError) {
              console.error("Session error:", sessionError);
              toast.error("Session error. Please try again.");
              setLoading(false);
              return;
            }

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
            const errorData = extractOTPError(otpData, otpError);
            const errorMessage = getOTPErrorMessage(errorData);
            toast.error(errorMessage, { duration: errorData.errorCode === 'RATE_LIMITED' ? 6000 : 4000 });
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
      toast.error(error.message || "An unexpected error occurred. Please check your connection and try again. If the problem persists, contact support.");
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
      <NetworkAccessDialog />
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
                      {countryCodes.map((c) => (
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

              <div className="relative flex items-center py-2">
                <Separator className="flex-1" />
                <span className="px-3 text-xs text-muted-foreground uppercase">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { error } = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (error) {
                      toast.error(error.message || "Google sign-in failed");
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Google sign-in failed");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
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
