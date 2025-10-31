import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import finmoLogo from "@/assets/finmo-logo.png";
import { supabase } from "@/integrations/supabase/client";

const PhoneVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [useOTP, setUseOTP] = useState(false);

  useEffect(() => {
    // Get data from location state
    const phone = location.state?.phoneNumber;
    const userEmail = location.state?.email;
    const loginMode = location.state?.isLogin;
    const otpMode = location.state?.useOTP;
    
    if (!phone) {
      toast.error("No phone number provided");
      navigate("/auth");
      return;
    }
    
    setPhoneNumber(phone);
    setEmail(userEmail || "");
    setIsLogin(loginMode !== false);
    setUseOTP(otpMode === true);
  }, [location, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify OTP via backend
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('confirm-phone-otp', {
        body: { 
          phoneNumber: phoneNumber,
          otp: code
        }
      });

      if (verifyError || !verifyData.success) {
        toast.error(verifyData?.error || "Invalid verification code. Please check the code and try again, or request a new code.");
        setLoading(false);
        return;
      }

      if (isLogin && useOTP) {
        // OTP Login flow - create session after phone verification
        console.log("OTP login - creating session for:", phoneNumber);

        const { data: loginData, error: loginError } = await supabase.functions.invoke('otp-login', {
          body: { phoneNumber: phoneNumber }
        });

        if (loginError || !loginData.success) {
          console.error("OTP login error:", loginError);
          toast.error(loginData?.error || "Unable to complete login. This may be due to a network issue. Please try password login or contact support.");
          navigate("/auth");
          return;
        }

        // Set the session using the tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: loginData.access_token,
          refresh_token: loginData.refresh_token,
        });

        if (sessionError) {
          console.error("Session error:", sessionError);
          toast.error("Unable to create your session. Please try password login or contact support if this persists.");
          navigate("/auth");
          return;
        }

        toast.success("Welcome back!");
        navigate("/dashboard");
      } else if (!isLogin) {
        // Signup flow - create new account
        if (!email) {
          toast.error("Email is required for account creation");
          navigate("/auth");
          return;
        }

        const password = location.state?.password;
        if (!password) {
          toast.error("Password is required");
          navigate("/auth");
          return;
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              phone_number: phoneNumber,
              phone_verified_at: new Date().toISOString(),
            },
            emailRedirectTo: `${window.location.origin}/dashboard`
          },
        });

        if (signupError) {
          toast.error(signupError.message);
          setLoading(false);
          return;
        }

        if (signupData.user) {
          // Auto sign in after signup
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

          if (signInError) {
            toast.success("Account created! Please sign in.");
            navigate("/auth");
          } else {
            // Generate wallet after successful signup
            try {
              const { error: walletError } = await supabase.functions.invoke('generate-user-wallet');
              if (walletError) {
                console.error("Wallet generation error:", walletError);
                // Don't block signup, wallet can be generated later
              }
            } catch (error) {
              console.error("Wallet generation failed:", error);
              // Don't block signup, wallet can be generated later
            }
            
            toast.success("Account created successfully!");
            navigate("/dashboard");
          }
        }
      } else {
        // This shouldn't happen, but redirect to auth just in case
        toast.error("Invalid verification flow");
        navigate("/auth");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phoneNumber: phoneNumber }
      });

      if (error || !data.success) {
        toast.error(data?.error || "Failed to resend code");
        return;
      }

      toast.success("Verification code resent!");
    } catch (error: any) {
      console.error("Resend error:", error);
      toast.error("We couldn't send a new code. Please wait a moment and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-glow flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-finmo-lg animate-scale-in">
            <img src={finmoLogo} alt="FinMo" className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">FinMo</h1>
            <p className="text-white/80 text-sm mt-1">Verify your phone number</p>
          </div>
        </div>

        {/* Verification Card */}
        <Card className="shadow-finmo-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Enter Verification Code</CardTitle>
            <CardDescription className="text-center">
              {isLogin && useOTP ? (
                <>We sent a 6-digit code to {phoneNumber} to verify your login</>
              ) : (
                <>We sent a 6-digit code to {phoneNumber}</>
              )}
              {!isLogin && email && (
                <div className="mt-2 text-xs">
                  Account email: {email}
                </div>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11"
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? "Sending..." : "Resend Code"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            </form>
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

export default PhoneVerification;
