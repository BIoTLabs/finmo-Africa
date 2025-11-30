import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Lock } from "lucide-react";
import { toast } from "sonner";
import finmoLogo from "@/assets/finmo-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { PhoneVerificationDialog } from "@/components/PhoneVerificationDialog";
import { extractOTPError, getOTPErrorMessage } from "@/utils/errorMessages";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<"email" | "phone">("email");
  
  // Phone OTP states
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  
  // Password reset after phone verification
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send OTP to phone
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phoneNumber }
      });

      if (error || !data.success) {
        const errorData = extractOTPError(data, error);
        const errorMessage = getOTPErrorMessage(errorData);
        toast.error(errorMessage, { duration: errorData.errorCode === 'RATE_LIMITED' ? 6000 : 4000 });
        setLoading(false);
        return;
      }

      setShowPhoneVerification(true);
      toast.success("Verification code sent to your phone!");
    } catch (error: any) {
      console.error("Phone verification error:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerify = async (otp: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('confirm-phone-otp', {
        body: { phoneNumber, otp }
      });

      if (error) throw error;

      setPhoneVerified(true);
      setVerifiedPhone(phoneNumber);
      setShowPhoneVerification(false);
      toast.success("Phone verified! Now set your new password.");
      return true;
    } catch (error: any) {
      console.error("OTP verification error:", error);
      throw error;
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Use edge function to reset password
      const { data: resetData, error } = await supabase.functions.invoke('reset-password-phone', {
        body: { 
          phoneNumber: verifiedPhone, 
          newPassword 
        }
      });

      if (error) throw error;

      // If we got session tokens, sign in immediately
      if (resetData.access_token && resetData.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: resetData.access_token,
          refresh_token: resetData.refresh_token,
        });

        if (!sessionError) {
          toast.success("Password reset successfully! Logging you in...");
          navigate("/dashboard");
          return;
        }
      }

      // If requiresDelay is true, inform user to wait
      if (resetData.requiresDelay) {
        toast.success("Password reset! Please wait 10 seconds before logging in.");
      } else {
        toast.success("Password reset successfully!");
      }
      
      navigate("/auth");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phoneNumber }
      });

      if (error || !data.success) {
        const errorData = extractOTPError(data, error);
        const errorMessage = getOTPErrorMessage(errorData);
        toast.error(errorMessage, { duration: errorData.errorCode === 'RATE_LIMITED' ? 6000 : 4000 });
        return;
      }
      toast.success("Verification code resent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
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
            <p className="text-white/80 text-sm mt-1">Reset Your Password</p>
          </div>
        </div>

        {/* Reset Card */}
        <Card className="shadow-finmo-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/auth")}
                className="hover:bg-muted"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-2xl">Forgot Password</CardTitle>
            </div>
            <CardDescription>
              Choose your recovery method
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!phoneVerified ? (
              <Tabs value={recoveryMethod} onValueChange={(v) => setRecoveryMethod(v as "email" | "phone")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-4 mt-4">
                  {!sent ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                          <Mail className="w-4 h-4" />
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11 text-base font-semibold"
                        disabled={loading}
                      >
                        {loading ? "Sending..." : "Send Reset Link"}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                        <p className="text-sm text-center">
                          We've sent a password reset link to <strong>{email}</strong>
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate("/auth")}
                        variant="outline"
                        className="w-full"
                      >
                        Back to Sign In
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="phone" className="space-y-4 mt-4">
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="w-4 h-4" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="08067386529"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter your registered phone number
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11 text-base font-semibold"
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send Verification Code"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg mb-4">
                  <p className="text-sm text-center">
                    Phone verified: <strong>{verifiedPhone}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-4 h-4" />
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-4 h-4" />
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity h-11 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <PhoneVerificationDialog
          open={showPhoneVerification}
          onCancel={() => setShowPhoneVerification(false)}
          onVerify={handlePhoneVerify}
          phoneNumber={phoneNumber}
          onResend={handleResendOTP}
        />
      </div>
    </div>
  );
};

export default ForgotPassword;
