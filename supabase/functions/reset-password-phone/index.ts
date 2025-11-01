import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface ResetPasswordRequest {
  phoneNumber: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, newPassword } = await req.json() as ResetPasswordRequest;

    if (!phoneNumber || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Phone number and new password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone to E.164 format
    let normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '+234' + normalizedPhone.substring(1);
      } else if (normalizedPhone.startsWith('234')) {
        normalizedPhone = '+' + normalizedPhone;
      } else {
        normalizedPhone = '+234' + normalizedPhone;
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if phone was recently verified (within last 5 minutes)
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

    // Find user by phone number
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

    // Update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a session token for immediate login
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkError || !linkData) {
      console.error('Failed to generate session:', linkError);
      // Password was reset but session creation failed - still success
      await supabase
        .from('phone_verifications')
        .update({ verified: false })
        .eq('id', verification.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password reset successfully. Please wait 10 seconds before logging in.',
          requiresDelay: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate the verification to prevent reuse
    await supabase
      .from('phone_verifications')
      .update({ verified: false })
      .eq('id', verification.id);

    console.log(`Password reset successfully for user: ${profile.id}`);

    // Extract tokens from the generated link
    const url = new URL(linkData.properties.action_link);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password reset successfully. Please wait 10 seconds before logging in.',
          requiresDelay: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successfully',
        access_token: accessToken,
        refresh_token: refreshToken,
        email: profile.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-password-phone:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
