import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailOTPRequest {
  email: string;
  otp: string;
  expiresInMinutes?: number;
}

const getEmailHTML = (otp: string, expiresInMinutes: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinMo Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 0 30px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 24px; font-weight: bold;">FinMo Verification Code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0; color: #333; font-size: 14px; line-height: 24px;">
              <p style="margin: 16px 0;">Hello! You've requested a verification code for your FinMo account.</p>
              <p style="margin: 16px 0 14px;">Your verification code is:</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f4f4f4; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333; line-height: 40px;">${otp}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0; color: #333; font-size: 14px; line-height: 24px;">
              <p style="margin: 16px 0;">This code will expire in ${expiresInMinutes} minutes.</p>
              <p style="margin: 14px 0 16px; color: #ababab;">If you didn't request this code, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 0 0; text-align: center;">
              <p style="margin: 0; color: #898989; font-size: 12px; line-height: 22px;">FinMo - Send money instantly across Africa</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, expiresInMinutes = 10 } = await req.json() as SendEmailOTPRequest;

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ 
          error: 'Email and OTP are required',
          errorCode: 'INVALID_REQUEST'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Email service is not configured',
          errorCode: 'SERVICE_UNAVAILABLE'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'FinMo <onboarding@resend.dev>',
      to: [email],
      subject: `Your FinMo verification code is ${otp}`,
      html: getEmailHTML(otp, expiresInMinutes),
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send verification email. Please try again or use SMS/voice call.',
          errorCode: 'EMAIL_SEND_FAILED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email OTP sent successfully:', data?.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Verification code sent to email',
        emailId: data?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-email-otp:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred while sending email',
        errorCode: 'SYSTEM_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
