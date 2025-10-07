import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    console.log("Sending payment request email to:", recipient_email);

    const paymentUrl = `https://39f749dd-e983-4411-b0e9-48f73cf4294c.lovableproject.com/payment-request/${payment_request_id}`;

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
      
      // Check for domain verification error
      if (errorData.statusCode === 403) {
        throw new Error("Email domain not verified. Please verify a domain at resend.com/domains and update the 'from' address to use that domain.");
      }
      
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const emailResult = await emailResponse.json();

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResponse: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payment request email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
