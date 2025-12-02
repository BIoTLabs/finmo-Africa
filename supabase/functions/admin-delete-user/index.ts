import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
  force?: boolean; // Allow deletion even with balances if true
}

interface DependencyCheck {
  activeP2POrders: number;
  activeMarketplaceOrders: number;
  balances: Array<{ token: string; balance: string; chain_id: number }>;
  hasKYC: boolean;
  virtualCards: number;
  stakingPositions: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin status
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminError || !adminCheck) {
      console.error('Admin check failed:', adminError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, force = false } = await req.json() as DeleteUserRequest;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} attempting to delete user ${userId}`);

    // Check if user exists
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('phone_number, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform dependency checks
    const dependencies: DependencyCheck = {
      activeP2POrders: 0,
      activeMarketplaceOrders: 0,
      balances: [],
      hasKYC: false,
      virtualCards: 0,
      stakingPositions: 0
    };

    // Check active P2P orders
    const { data: p2pOrders, error: p2pError } = await supabaseClient
      .from('p2p_orders')
      .select('id, status')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in('status', ['pending', 'paid']);

    if (!p2pError && p2pOrders) {
      dependencies.activeP2POrders = p2pOrders.length;
    }

    // Check active marketplace orders
    const { data: marketplaceOrders, error: marketplaceError } = await supabaseClient
      .from('marketplace_orders')
      .select('id, status')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in('status', ['pending', 'paid', 'confirmed', 'in_delivery']);

    if (!marketplaceError && marketplaceOrders) {
      dependencies.activeMarketplaceOrders = marketplaceOrders.length;
    }

    // Check wallet balances
    const { data: balances, error: balanceError } = await supabaseClient
      .from('wallet_balances')
      .select('token, balance, chain_id')
      .eq('user_id', userId)
      .gt('balance', 0);

    if (!balanceError && balances) {
      dependencies.balances = balances;
    }

    // Check KYC
    const { data: kyc, error: kycError } = await supabaseClient
      .from('kyc_verifications')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    dependencies.hasKYC = !kycError && kyc !== null;

    // Check virtual cards
    const { data: cards, error: cardsError } = await supabaseClient
      .from('virtual_cards')
      .select('id')
      .eq('user_id', userId);

    if (!cardsError && cards) {
      dependencies.virtualCards = cards.length;
    }

    // Check staking positions
    const { data: staking, error: stakingError } = await supabaseClient
      .from('staking_positions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!stakingError && staking) {
      dependencies.stakingPositions = staking.length;
    }

    // Check for blocking conditions
    if (dependencies.activeP2POrders > 0 || dependencies.activeMarketplaceOrders > 0) {
      return new Response(
        JSON.stringify({
          error: 'Cannot delete user with active orders',
          dependencies,
          canDelete: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dependencies.balances.length > 0 && !force) {
      return new Response(
        JSON.stringify({
          error: 'User has non-zero balances',
          dependencies,
          canDelete: false,
          requiresForce: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we get here, proceed with deletion
    console.log(`Deleting user ${userId} - Dependencies:`, dependencies);

    // Delete in order to respect foreign keys
    const deletionSteps = [];

    // 1. Delete user sessions
    await supabaseClient.from('user_sessions').delete().eq('user_id', userId);
    deletionSteps.push('user_sessions');

    // 2. Delete user badges
    await supabaseClient.from('user_badges').delete().eq('user_id', userId);
    deletionSteps.push('user_badges');

    // 3. Delete ratings
    await supabaseClient.from('user_ratings').delete().or(`rated_user_id.eq.${userId},rated_by_user_id.eq.${userId}`);
    deletionSteps.push('user_ratings');

    // 4. Delete rewards
    await supabaseClient.from('reward_activities').delete().eq('user_id', userId);
    await supabaseClient.from('user_rewards').delete().eq('user_id', userId);
    deletionSteps.push('rewards');

    // 5. Delete virtual cards
    await supabaseClient.from('card_transactions').delete().eq('user_id', userId);
    await supabaseClient.from('virtual_cards').delete().eq('user_id', userId);
    deletionSteps.push('virtual_cards');

    // 6. Delete marketplace data
    await supabaseClient.from('marketplace_notifications').delete().eq('user_id', userId);
    await supabaseClient.from('marketplace_bids').delete().or(`bidder_id.eq.${userId},seller_id.eq.${userId}`);
    await supabaseClient.from('marketplace_delivery_bids').delete().eq('rider_id', userId);
    deletionSteps.push('marketplace_data');

    // 7. Delete messages
    await supabaseClient.from('order_messages').delete().eq('sender_id', userId);
    deletionSteps.push('order_messages');

    // 8. Delete disputes
    await supabaseClient.from('p2p_disputes').delete().or(`raised_by.eq.${userId},resolved_by.eq.${userId}`);
    await supabaseClient.from('disputes').delete().or(`user_id.eq.${userId},resolved_by.eq.${userId}`);
    deletionSteps.push('disputes');

    // 9. Delete KYC and storage files
    if (dependencies.hasKYC) {
      const { data: kycData } = await supabaseClient
        .from('kyc_verifications')
        .select('id_document_url, selfie_url')
        .eq('user_id', userId)
        .single();

      if (kycData) {
        if (kycData.id_document_url) {
          const docPath = kycData.id_document_url.split('/').pop();
          if (docPath) {
            await supabaseClient.storage.from('kyc-documents').remove([docPath]);
          }
        }
        if (kycData.selfie_url) {
          const selfiePath = kycData.selfie_url.split('/').pop();
          if (selfiePath) {
            await supabaseClient.storage.from('kyc-documents').remove([selfiePath]);
          }
        }
      }
      await supabaseClient.from('kyc_verifications').delete().eq('user_id', userId);
      deletionSteps.push('kyc');
    }

    // 10. Delete payment methods
    await supabaseClient.from('payment_methods').delete().eq('user_id', userId);
    deletionSteps.push('payment_methods');

    // 11. Delete staking
    await supabaseClient.from('staking_positions').delete().eq('user_id', userId);
    deletionSteps.push('staking_positions');

    // 12. Delete wallet data
    await supabaseClient.from('wallet_sweeps').delete().eq('user_id', userId);
    await supabaseClient.from('wallet_balances').delete().eq('user_id', userId);
    await supabaseClient.from('gas_fundings').delete().eq('user_id', userId);
    deletionSteps.push('wallet_data');

    // 13. Delete contacts
    await supabaseClient.from('contacts').delete().eq('user_id', userId);
    await supabaseClient.from('contact_invitations').delete().eq('inviter_id', userId);
    deletionSteps.push('contacts');

    // 14. Delete verification data
    await supabaseClient.from('phone_verifications').delete().eq('phone_number', profile.phone_number);
    await supabaseClient.from('verification_attempts').delete().eq('phone_number', profile.phone_number);
    deletionSteps.push('verifications');

    // 15. Delete 2FA preferences
    await supabaseClient.from('user_2fa_preferences').delete().eq('user_id', userId);
    deletionSteps.push('2fa_preferences');

    // 16. Anonymize transactions (don't delete)
    await supabaseClient
      .from('transactions')
      .update({ sender_id: null, recipient_id: null })
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    deletionSteps.push('transactions_anonymized');

    // 17. Delete completed orders
    await supabaseClient.from('p2p_orders').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    await supabaseClient.from('marketplace_orders').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    deletionSteps.push('orders');

    // 18. Delete listings
    await supabaseClient.from('p2p_listings').delete().eq('user_id', userId);
    await supabaseClient.from('marketplace_listings').delete().eq('seller_id', userId);
    deletionSteps.push('listings');

    // 19. Delete payment requests
    await supabaseClient.from('payment_requests').delete().or(`requester_id.eq.${userId},payer_id.eq.${userId}`);
    deletionSteps.push('payment_requests');

    // 20. Delete poll responses
    await supabaseClient.from('virtual_card_poll').delete().eq('user_id', userId);
    deletionSteps.push('virtual_card_poll');

    // 21. Delete user roles
    await supabaseClient.from('user_roles').delete().eq('user_id', userId);
    deletionSteps.push('user_roles');

    // 22. Delete user registry
    await supabaseClient.from('user_registry').delete().eq('user_id', userId);
    deletionSteps.push('user_registry');

    // 23. Delete profile
    await supabaseClient.from('profiles').delete().eq('id', userId);
    deletionSteps.push('profiles');

    // 24. Delete from Auth (final step)
    const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Auth deletion error:', deleteAuthError);
      return new Response(
        JSON.stringify({
          error: 'Failed to delete from Auth',
          details: deleteAuthError.message,
          partialDeletion: deletionSteps
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    deletionSteps.push('auth');

    console.log(`Successfully deleted user ${userId}. Completed steps:`, deletionSteps);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User successfully deleted',
        userId,
        userName: profile.display_name || profile.phone_number,
        dependencies,
        deletionSteps
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-delete-user:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
