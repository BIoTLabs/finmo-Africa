import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequestSMS {
  payment_request_id: string;
  recipient_phone: string;
  recipient_name?: string;
  requester_name: string;
  amount: number;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      payment_request_id,
      recipient_phone,
      recipient_name,
      requester_name,
      amount,
      token,
    }: PaymentRequestSMS = await req.json();

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error("Twilio credentials not configured");
    }

    console.log("Sending payment request SMS to:", recipient_phone);

    const paymentUrl = `https://39f749dd-e983-4411-b0e9-48f73cf4294c.lovableproject.com/payment-request/${payment_request_id}`;

    const message = `${requester_name} has requested a payment of $${amount} ${token} via FinMo. Pay now: ${paymentUrl}`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", recipient_phone);
    formData.append("From", twilioPhoneNumber);
    formData.append("Body", message);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Twilio error:", errorData);
      throw new Error(`Twilio API error: ${errorData.message || response.statusText}`);
    }

    const smsResponse = await response.json();
    console.log("SMS sent successfully:", smsResponse);

    return new Response(JSON.stringify({ success: true, smsResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payment request SMS:", error);
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
