import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !password) {
      toast.error('Please enter phone number and password');
      return;
    }

    setLoading(true);

    try {
      // Use server-side login to get email from phone
      const { data: loginData, error: loginError } = await supabase.functions.invoke('phone-password-login', {
        body: { phoneNumber, password }
      });

      if (loginError) {
        console.error('Edge function error:', loginError);
        throw new Error(loginError.message || 'Login failed');
      }

      if (!loginData) {
        throw new Error('No response from server');
      }

      if (loginData.error) {
        throw new Error(loginData.error);
      }

      if (!loginData.session?.access_token) {
        throw new Error('Invalid credentials');
      }

      // Set the session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: loginData.session.access_token,
        refresh_token: loginData.session.refresh_token
      });

      if (sessionError) {
        throw new Error('Failed to establish session');
      }

      // Verify admin role
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Authentication failed');
      }

      const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (roleError) {
        throw new Error('Failed to verify admin status');
      }

      if (!isAdmin) {
        // Sign out non-admin user
        await supabase.auth.signOut();
        toast.error('Access denied - Admin credentials required');
        return;
      }

      toast.success('Welcome, Admin');
      navigate('/admin');
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-amber-500/20 bg-slate-900/90 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Admin Portal</CardTitle>
          <CardDescription className="text-slate-400">
            Secure access for administrators only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Access Admin Dashboard'
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            This portal is for authorized administrators only.
            <br />
            Unauthorized access attempts are logged.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
