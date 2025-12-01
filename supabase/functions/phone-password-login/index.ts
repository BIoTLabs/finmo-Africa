import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateAndNormalizePhone } from "../_shared/phoneValidation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
};

interface LoginRequest {
  phoneNumber: string;
  password: string;
  ipAddress?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, password, ipAddress } = await req.json() as LoginRequest;

    if (!phoneNumber || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'MISSING_CREDENTIALS',
          message: 'Phone number and password are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize phone number
    const validation = validateAndNormalizePhone(phoneNumber);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_PHONE',
          message: validation.error || 'Invalid phone number format'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = validation.normalized!;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limiting before proceeding
    const { data: rateLimitCheck } = await supabase.rpc('check_rate_limit', {
      _user_ip: ipAddress || 'unknown',
      _action_type: 'phone_password_login',
      _max_requests: 5,
      _time_window_minutes: 15
    });

    if (!rateLimitCheck) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again in 15 minutes.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lookup user by phone number (server-side only)
    const { data: userRegistry } = await supabase
      .from('user_registry')
      .select('user_id')
      .eq('phone_number', normalizedPhone)
      .single();

    if (!userRegistry) {
      console.log(`Login attempt for non-existent phone: ${normalizedPhone.substring(0, 6)}***`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid phone number or password'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user email from profiles (server-side only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userRegistry.user_id)
      .single();

    if (!profile || !profile.email) {
      console.error(`User ${userRegistry.user_id} has no email in profile`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'ACCOUNT_ERROR',
          message: 'Account configuration error. Please contact support.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate with Supabase Auth using email + password
    // Create admin client for sign in
    const adminAuthClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: authData, error: authError } = await adminAuthClient.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (authError || !authData.session) {
      console.log(`Failed login attempt for user: ${userRegistry.user_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid phone number or password'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successful login for user: ${userRegistry.user_id}`);

    // Return session tokens (not email or userId for security)
    return new Response(
      JSON.stringify({
        success: true,
        session: authData.session,
        user: authData.user
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Phone password login error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'SERVER_ERROR',
        message: 'An error occurred during login. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
