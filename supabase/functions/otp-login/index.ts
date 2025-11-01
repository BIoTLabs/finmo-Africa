import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAndNormalizePhone } from '../_shared/phoneValidation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface OTPLoginRequest {
  phoneNumber: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber } = await req.json() as OTPLoginRequest;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize phone number
    const validation = validateAndNormalizePhone(phoneNumber);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = validation.normalized!;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify phone was recently verified (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: verification, error: verificationError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('verified', true)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (verificationError || !verification) {
      console.error('No recent verification found:', verificationError);
      return new Response(
        JSON.stringify({ error: 'Phone verification expired or not found. Please verify your phone again.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('phone_number', normalizedPhone)
      .single();

    if (profileError || !profile) {
      console.error('User not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'No account found with this phone number' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a magic link for immediate login
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkError || !linkData) {
      console.error('Failed to generate session:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate the phone verification
    await supabase
      .from('phone_verifications')
      .update({ verified: false })
      .eq('id', verification.id);

    console.log(`OTP login successful for user: ${profile.id}`);

    // Extract tokens from the generated link
    const url = new URL(linkData.properties.action_link);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract session tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        email: profile.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in otp-login:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
