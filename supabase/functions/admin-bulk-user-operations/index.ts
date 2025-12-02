import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
};

interface BulkOperationRequest {
  operation: 'suspend' | 'unsuspend' | 'delete';
  userIds: string[];
  reason?: string; // For suspensions
  expiresAt?: string; // For temporary suspensions
  force?: boolean; // For deletions with balances
  ipAddress?: string;
  userAgent?: string;
}

const MAX_BATCH_SIZE = 50;

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

    const { operation, userIds, reason, expiresAt, force, ipAddress, userAgent } = await req.json() as BulkOperationRequest;

    if (!operation || !userIds || userIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: operation, userIds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userIds.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: `Maximum batch size is ${MAX_BATCH_SIZE} users` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'suspend' && !reason) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reason required for suspension' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { userId: string; error: string }[]
    };

    // Process each user
    for (const userId of userIds) {
      try {
        if (operation === 'suspend') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number, display_name, is_suspended')
            .eq('id', userId)
            .single();

          if (!profile) {
            results.failed.push({ userId, error: 'User not found' });
            continue;
          }

          if (profile.is_suspended) {
            results.failed.push({ userId, error: 'Already suspended' });
            continue;
          }

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

          if (updateError) throw updateError;

          await supabase.from('admin_audit_logs').insert({
            admin_id: user.id,
            action_type: 'user_suspended_bulk',
            target_user_id: userId,
            target_user_phone: profile.phone_number,
            metadata: { reason, expires_at: expiresAt, display_name: profile.display_name },
            ip_address: ipAddress,
            user_agent: userAgent
          });

          results.success.push(userId);

        } else if (operation === 'unsuspend') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number, display_name, is_suspended')
            .eq('id', userId)
            .single();

          if (!profile) {
            results.failed.push({ userId, error: 'User not found' });
            continue;
          }

          if (!profile.is_suspended) {
            results.failed.push({ userId, error: 'Not suspended' });
            continue;
          }

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

          if (updateError) throw updateError;

          await supabase.from('admin_audit_logs').insert({
            admin_id: user.id,
            action_type: 'user_unsuspended_bulk',
            target_user_id: userId,
            target_user_phone: profile.phone_number,
            metadata: { display_name: profile.display_name },
            ip_address: ipAddress,
            user_agent: userAgent
          });

          results.success.push(userId);

        } else if (operation === 'delete') {
          // Call the delete-user-account edge function for each user
          const deleteResponse = await supabase.functions.invoke('admin-delete-user', {
            body: { userId, force }
          });

          if (deleteResponse.error || !deleteResponse.data?.success) {
            results.failed.push({ 
              userId, 
              error: deleteResponse.data?.error || 'Delete failed' 
            });
            continue;
          }

          results.success.push(userId);
        }

      } catch (error: any) {
        console.error(`Error processing user ${userId}:`, error);
        results.failed.push({ userId, error: error.message || 'Unknown error' });
      }
    }

    // Create summary audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: `bulk_operation_${operation}`,
      target_user_id: null,
      target_user_phone: null,
      metadata: {
        total_users: userIds.length,
        successful: results.success.length,
        failed: results.failed.length,
        operation,
        reason
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    console.log(`Bulk ${operation} completed. Success: ${results.success.length}, Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: userIds.length,
          successful: results.success.length,
          failed: results.failed.length
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk operation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});