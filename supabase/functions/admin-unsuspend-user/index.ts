import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
};

interface UnsuspendUserRequest {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, ipAddress, userAgent } = await req.json() as UnsuspendUserRequest;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user details before unsuspension
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number, display_name, is_suspended')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.is_suspended) {
      return new Response(
        JSON.stringify({ success: false, error: 'User is not suspended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear suspension fields
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_suspended: false,
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
        suspension_expires_at: null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error unsuspending user:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to unsuspend user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: 'user_unsuspended',
      target_user_id: userId,
      target_user_phone: profile.phone_number,
      metadata: {
        display_name: profile.display_name
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    console.log(`User ${userId} unsuspended by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User unsuspended successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unsuspend user error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});