import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Lock, Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      const fullPhone = `${countryCode}${phoneNumber}`;

      if (isLogin) {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: `${fullPhone}@finmo.app`,
          password,
        });

        if (error) {
          console.error("Login error:", error);
          throw error;
        }
        
        if (data.session) {
          toast.success("Welcome back!");
          navigate("/dashboard");
        }
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: `${fullPhone}@finmo.app`,
          password,
          options: {
            data: {
              phone_number: fullPhone,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) {
          console.error("Signup error:", error);
          throw error;
        }
        
        if (data.session) {
          toast.success("Account created successfully!");
          navigate("/dashboard");
        } else if (data.user) {
          toast.success("Account created! Please check your email to confirm.");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
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
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Info Section */}
        <div className="hidden md:block text-primary-foreground space-y-6">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold">Welcome to FinMo</h2>
            <p className="text-lg opacity-90">
              Your gateway to instant, secure cryptocurrency payments across Africa
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">What is FinMo?</h3>
            <p className="opacity-90">
              FinMo is a mobile-first crypto wallet that makes sending money as easy as sending a text message. 
              Send USDC and MATIC to anyone using just their phone number - no complex wallet addresses needed.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Key Features:</h3>
            <ul className="space-y-2 opacity-90">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span><strong>Instant Transfers:</strong> Send money to other FinMo users instantly with zero fees</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span><strong>Phone-Based Contacts:</strong> Find friends using their phone numbers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span><strong>P2P Trading:</strong> Buy and sell crypto directly with other users</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span><strong>Virtual Cards:</strong> Create prepaid cards for online shopping</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span><strong>Secure Wallet:</strong> Your funds are protected with industry-standard encryption</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Getting Started:</h3>
            <ol className="space-y-2 opacity-90 list-decimal list-inside">
              <li>Sign up with your phone number</li>
              <li>Get your secure wallet address automatically</li>
              <li>Add funds via P2P or blockchain deposit</li>
              <li>Start sending money to contacts instantly</li>
            </ol>
          </div>
        </div>

        {/* Auth Form */}
        <Card className="w-full shadow-finmo-lg animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-finmo-md">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              FinMo
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isLogin ? "Welcome back to your wallet" : "Create your secure wallet"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Phone Number
              </Label>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-32">
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
              <Label htmlFor="password" className="flex items-center gap-2">
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
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </form>

          {!isLogin && (
            <div className="mt-6 p-4 bg-accent rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                By creating an account, you'll get a secure wallet address for instant transfers within FinMo
              </p>
            </div>
          )}

          {/* Mobile Info Section */}
          <div className="md:hidden mt-6 space-y-4 text-center">
            <div className="p-4 bg-white/10 rounded-lg text-primary-foreground">
              <h3 className="font-semibold mb-2">What is FinMo?</h3>
              <p className="text-sm opacity-90">
                Send crypto instantly using phone numbers. Zero fees, instant delivery, secure wallets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Auth;
