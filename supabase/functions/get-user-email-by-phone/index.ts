import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAndNormalizePhone } from '../_shared/phoneValidation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetEmailRequest {
  phoneNumber: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber } = await req.json() as GetEmailRequest;

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

    // Use service role to query profiles table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up user by phone number
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, id')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();

    if (profileError) {
      console.error('Error looking up profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Error looking up account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profileData || !profileData.email) {
      console.log(`No account found for phone: ${normalizedPhone}`);
      return new Response(
        JSON.stringify({ error: 'Account not found. Please check your phone number or sign up.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found account for phone: ${normalizedPhone}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: profileData.email,
        userId: profileData.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-user-email-by-phone:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
