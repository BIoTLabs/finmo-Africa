import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Request-Private-Network": "false",
};

interface InvitationRequest {
  contactName: string;
  contactPhone: string;
  inviterName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactName, contactPhone, inviterName }: InvitationRequest = await req.json();

    // Validate phone number (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(contactPhone)) {
      throw new Error('Invalid phone number format. Use international format: +1234567890');
    }

    // Prevent repeated digits (possible test/invalid numbers)
    if (/(\d)\1{9,}/.test(contactPhone)) {
      throw new Error('Invalid phone number');
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('Twilio credentials not configured');
      throw new Error('SMS service unavailable. Please try again later.');
    }

    // Create the invitation message
    const message = `Hi ${contactName}! ${inviterName} invited you to join FinMo - a secure digital wallet for instant transfers, P2P trading, and marketplace shopping. Download now: https://finmo.africa`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", contactPhone);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.text();
      console.error("Twilio error:", errorData);
      throw new Error('Failed to send invitation SMS');
    }

    const twilioData = await twilioResponse.json();
    console.log("SMS sent successfully:", twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation-sms function:", {
      message: error?.message,
      stack: error?.stack
    });
    
    // Return generic error message
    const userMessage = error?.message?.includes('Invalid phone number') 
      ? error.message 
      : 'Unable to send invitation. Please try again later.';
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
