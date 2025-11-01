import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAndNormalizePhone } from '../_shared/phoneValidation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface VerifyPhoneRequest {
  phoneNumber: string;
  ipAddress?: string;
  isLogin?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, ipAddress, isLogin } = await req.json() as VerifyPhoneRequest;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize phone number
    const validation = validateAndNormalizePhone(phoneNumber);
    
    if (!validation.valid) {
      console.error('Phone validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = validation.normalized!;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If this is a login request, verify the user exists
    if (isLogin) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking user existence:', profileError);
        return new Response(
          JSON.stringify({ error: 'Error validating account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profileData) {
        console.log(`Login attempt for non-existent phone: ${normalizedPhone}`);
        return new Response(
          JSON.stringify({ error: 'Account not found. Please check your phone number or sign up.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`OTP login validation passed for: ${normalizedPhone}`);
    }

    // Check rate limiting - max 3 attempts per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAttempts, error: attemptsError } = await supabase
      .from('verification_attempts')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .gte('attempted_at', oneHourAgo);

    if (attemptsError) {
      console.error('Error checking rate limit:', attemptsError);
    }

    if (recentAttempts && recentAttempts.length >= 3) {
      const oldestAttempt = recentAttempts.sort((a, b) => 
        new Date(a.attempted_at).getTime() - new Date(b.attempted_at).getTime()
      )[0];
      const retryTime = new Date(new Date(oldestAttempt.attempted_at).getTime() + 60 * 60 * 1000);
      const minutesLeft = Math.ceil((retryTime.getTime() - Date.now()) / (60 * 1000));
      
      return new Response(
        JSON.stringify({ 
          error: `Too many verification attempts. For security, you can only request 3 codes per hour. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
          retryAfter: retryTime.toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('OTP generated and will be sent via SMS');

    // Hash OTP using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store OTP hash with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from('phone_verifications')
      .insert({
        phone_number: normalizedPhone,
        otp_hash: otpHash,
        expires_at: expiresAt,
        verified: false,
        attempts: 0,
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Unable to generate verification code due to a system error. This is usually temporary - please try again in a few moments. If the problem persists, contact support.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log verification attempt
    await supabase.from('verification_attempts').insert({
      phone_number: normalizedPhone,
      ip_address: ipAddress,
    });

    // Send OTP via Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'SMS service is currently unavailable. Our team has been notified and is working to restore service. Please try again later or contact support for assistance.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = `Your FinMo verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio error:', errorText);
      
      let errorMessage = 'Unable to send SMS to your number. ';
      if (twilioResponse.status === 400) {
        errorMessage += 'Please verify your phone number is correct and includes the country code.';
      } else if (twilioResponse.status === 429) {
        errorMessage += 'Too many messages sent to this number. Please try again in 10 minutes.';
      } else {
        errorMessage += 'This may be due to network issues or an unsupported carrier. Please try again in a few minutes or contact support.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioData = await twilioResponse.json();
    console.log('OTP sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent',
        phoneNumber: normalizedPhone 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-phone-otp:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred while processing your request. Please try again in a few moments. If the problem continues, contact our support team for assistance.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});