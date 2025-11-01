import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user is admin
    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' })

    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all database functions
    const dbFunctions = [
      'generate_wallet_address',
      'handle_new_user',
      'initialize_wallet_balances',
      'lookup_user_by_phone',
      'update_updated_at_column',
      'has_role'
    ]

    // Get all tables
    const dbTables = [
      'contacts',
      'profiles',
      'transactions',
      'user_registry',
      'wallet_balances',
      'user_roles'
    ]

    // Get edge functions (hardcoded list of known functions)
    const edgeFunctions = [
      'process-transaction',
      'get-backend-info'
    ]

    // Get table counts
    const tableCounts: Record<string, number> = {}
    for (const table of dbTables) {
      const { count, error } = await supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.error(`Error counting ${table}:`, error)
        tableCounts[table] = 0
      } else {
        tableCounts[table] = count || 0
      }
    }

    const backendInfo = {
      timestamp: new Date().toISOString(),
      database: {
        functions: dbFunctions,
        tables: dbTables,
        tableCounts,
      },
      edgeFunctions,
      integrations: {
        authentication: true,
        realtimeEnabled: true,
        storageEnabled: false,
      },
    }

    console.log('Backend info retrieved successfully for admin:', user.id)

    return new Response(JSON.stringify(backendInfo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in get-backend-info:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})