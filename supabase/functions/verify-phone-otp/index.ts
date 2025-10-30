import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPhoneRequest {
  phoneNumber: string;
  ipAddress?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, ipAddress } = await req.json() as VerifyPhoneRequest;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
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
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please try again in an hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Generated OTP for ${normalizedPhone}: ${otp}`);

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
        JSON.stringify({ error: 'Failed to generate verification code' }),
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
        JSON.stringify({ error: 'SMS service not configured' }),
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
      return new Response(
        JSON.stringify({ error: 'Failed to send verification code' }),
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});