import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
};

interface SuspendUserRequest {
  userId: string;
  reason: string;
  expiresAt?: string; // ISO timestamp for temporary suspension
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

    const { userId, reason, expiresAt, ipAddress, userAgent } = await req.json() as SuspendUserRequest;

    if (!userId || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: userId, reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user details before suspension
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number, display_name')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with suspension
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: user.id,
        suspension_reason: reason,
        suspension_expires_at: expiresAt || null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error suspending user:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to suspend user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: expiresAt ? 'user_suspended_temporary' : 'user_suspended_permanent',
      target_user_id: userId,
      target_user_phone: profile.phone_number,
      metadata: {
        reason,
        expires_at: expiresAt,
        display_name: profile.display_name
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    console.log(`User ${userId} suspended by admin ${user.id}. Reason: ${reason}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User suspended successfully',
        suspended_at: new Date().toISOString(),
        expires_at: expiresAt
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Suspend user error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});