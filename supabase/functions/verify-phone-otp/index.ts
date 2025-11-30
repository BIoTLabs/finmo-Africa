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
  deliveryMethod?: 'sms' | 'voice';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, ipAddress, isLogin, deliveryMethod = 'sms' } = await req.json() as VerifyPhoneRequest;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Phone number is required',
          errorCode: 'INVALID_PHONE'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize phone number
    const validation = validateAndNormalizePhone(phoneNumber);
    
    if (!validation.valid) {
      console.error('Phone validation failed:', validation.error);
      return new Response(
        JSON.stringify({ 
          error: validation.error,
          errorCode: 'INVALID_PHONE'
        }),
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
          JSON.stringify({ 
            error: 'Error validating account',
            errorCode: 'SYSTEM_ERROR'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profileData) {
        console.log(`Login attempt for non-existent phone: ${normalizedPhone}`);
        return new Response(
          JSON.stringify({ 
            error: 'Account not found. Please check your phone number or sign up.',
            errorCode: 'ACCOUNT_NOT_FOUND'
          }),
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
          errorCode: 'RATE_LIMITED',
          minutesLeft,
          retryAfter: retryTime.toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`OTP generated and will be sent via ${deliveryMethod.toUpperCase()}`);

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
          error: 'Unable to generate verification code due to a system error. This is usually temporary - please try again in a few moments. If the problem persists, contact support.',
          errorCode: 'SYSTEM_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log verification attempt
    await supabase.from('verification_attempts').insert({
      phone_number: normalizedPhone,
      ip_address: ipAddress,
    });

    // Send OTP via Twilio (SMS or Voice based on deliveryMethod)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      const serviceType = deliveryMethod === 'voice' ? 'Voice call' : 'SMS';
      return new Response(
        JSON.stringify({ 
          error: `${serviceType} service is currently unavailable. Our team has been notified and is working to restore service. Please try again later or contact support for assistance.`,
          errorCode: 'SERVICE_UNAVAILABLE'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    let twilioResponse: Response;

    if (deliveryMethod === 'voice') {
      // Voice call with TwiML
      const otpDigits = otp.split('').join('. ');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Hello! This is FinMo calling with your verification code.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">Your code is: ${otpDigits}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">I repeat, your code is: ${otpDigits}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">This code expires in 10 minutes. Thank you for using FinMo. Goodbye.</Say>
</Response>`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
      twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: normalizedPhone,
          From: twilioPhoneNumber,
          Twiml: twiml,
        }),
      });
    } else {
      // SMS message
      const message = `Your FinMo verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      twilioResponse = await fetch(twilioUrl, {
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
    }

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio error:', errorText);
      
      const serviceType = deliveryMethod === 'voice' ? 'call' : 'SMS';
      let errorMessage = `Unable to ${deliveryMethod === 'voice' ? 'place a call' : 'send SMS'} to your number. `;
      let errorCode = 'TWILIO_ERROR';
      
      if (twilioResponse.status === 400) {
        errorMessage += 'Please verify your phone number is correct and includes the country code.';
        errorCode = 'INVALID_PHONE';
      } else if (twilioResponse.status === 429) {
        errorMessage += `Too many ${serviceType}s sent to this number. Please try again in 10 minutes.`;
        errorCode = 'RATE_LIMITED';
      } else {
        errorMessage += 'This may be due to network issues or an unsupported carrier. Please try the other delivery method or contact support.';
        errorCode = 'CARRIER_BLOCKED';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          errorCode
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioData = await twilioResponse.json();
    const messageType = deliveryMethod === 'voice' ? 'Voice call initiated' : 'OTP sent via SMS';
    console.log(`${messageType} successfully:`, twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: deliveryMethod === 'voice' ? 'Voice call initiated' : 'Verification code sent',
        phoneNumber: normalizedPhone,
        deliveryMethod 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-phone-otp:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred while processing your request. Please try again in a few moments. If the problem continues, contact our support team for assistance.',
        errorCode: 'SYSTEM_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});