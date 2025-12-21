import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Request-Private-Network": "false",
};

interface PaymentRequestEmail {
  payment_request_id: string;
  recipient_email: string;
  recipient_name?: string;
  requester_name: string;
  amount: number;
  token: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      payment_request_id,
      recipient_email,
      recipient_name,
      requester_name,
      amount,
      token,
      message,
    }: PaymentRequestEmail = await req.json();

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured. Please set RESEND_API_KEY.");
    }

    console.log("Sending payment request email to:", recipient_email);

    // Get the site URL from environment
    const siteUrl = Deno.env.get("SUPABASE_SITE_URL") || "https://myfinmo.app";
    const paymentUrl = `${siteUrl}/payment-request/${payment_request_id}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .amount { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; margin: 20px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .message-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💳 Payment Request from ${requester_name}</h1>
            </div>
            <div class="content">
              <p>Hi${recipient_name ? ` ${recipient_name}` : ''},</p>
              <p>${requester_name} has requested a payment from you via FinMo.</p>
              
              <div class="amount">
                $${amount} ${token}
              </div>
              
              ${message ? `
                <div class="message-box">
                  <strong>Message:</strong>
                  <p>${message}</p>
                </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${paymentUrl}" class="button">Pay Now</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Don't have a FinMo account? No problem! Click the link above and we'll help you get set up in minutes.
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                This payment request will expire in 7 days.
              </p>
            </div>
            <div class="footer">
              <p>Sent via FinMo - Fast, secure payments</p>
              <p>If you didn't expect this payment request, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend API
    console.log(`Attempting to send payment request email to: ${recipient_email}`);
    console.log(`Amount: $${amount} ${token}, From: ${requester_name}`);

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FinMo <onboarding@resend.dev>',
        to: [recipient_email],
        subject: `Payment request for $${amount} ${token} from ${requester_name}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      console.error("Status code:", emailResponse.status);
      
      // Check for common errors with helpful messages
      if (errorData.statusCode === 403 || errorData.message?.includes("verify")) {
        throw new Error("Email domain not verified. In test mode, only verified email addresses can receive emails. Verify your domain at https://resend.com/domains or add recipient to verified emails.");
      }
      
      if (errorData.statusCode === 401) {
        throw new Error("Invalid Resend API key. Please check RESEND_API_KEY in your backend environment settings.");
      }

      if (errorData.message?.includes("not found")) {
        throw new Error("Recipient email not verified in Resend test mode. Add email to verified list at https://resend.com/settings");
      }
      
      throw new Error(`Resend API error: ${errorData.message || JSON.stringify(errorData)}`);
    }

    const emailResult = await emailResponse.json();

    console.log("✓ Payment request email sent successfully!");
    console.log("Email ID:", emailResult.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Payment request email sent successfully",
      emailId: emailResult.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payment request email:", error);
    console.error("Error details:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        hint: "Check edge function logs for more details"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
