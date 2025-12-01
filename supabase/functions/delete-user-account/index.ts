import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createErrorResponse, createSuccessResponse } from '../_shared/errorHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAccountRequest {
  phoneNumber: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, password }: DeleteAccountRequest = await req.json();

    if (!phoneNumber || !password) {
      return createErrorResponse('INVALID_INPUT', 'Phone number and password are required', corsHeaders);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Find user by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, phone_number')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return createErrorResponse('NOT_FOUND', 'User not found', corsHeaders);
    }

    // Step 2: Verify password by attempting to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (authError) {
      console.error('Authentication error:', authError);
      return createErrorResponse('UNAUTHORIZED', 'Invalid password', corsHeaders);
    }

    const userId = profile.id;

    // Step 3: Check for active orders
    const { data: activeP2POrders } = await supabase
      .from('p2p_orders')
      .select('id, status')
      .eq('buyer_id', userId)
      .in('status', ['pending', 'paid'])
      .limit(1);

    const { data: activeMarketplaceOrders } = await supabase
      .from('marketplace_orders')
      .select('id, status')
      .eq('buyer_id', userId)
      .in('status', ['pending', 'paid', 'shipped'])
      .limit(1);

    if ((activeP2POrders && activeP2POrders.length > 0) || (activeMarketplaceOrders && activeMarketplaceOrders.length > 0)) {
      return createErrorResponse(
        'OPERATION_NOT_ALLOWED',
        'Cannot delete account with active orders. Please complete or cancel all orders first.',
        corsHeaders
      );
    }

    // Step 4: Get wallet balances for warning
    const { data: balances } = await supabase
      .from('wallet_balances')
      .select('token, balance, chain_id')
      .eq('user_id', userId)
      .gt('balance', 0);

    const hasBalances = balances && balances.length > 0;
    if (hasBalances) {
      const totalBalances = balances.map(b => `${b.balance} ${b.token}`).join(', ');
      console.warn(`User ${userId} has non-zero balances: ${totalBalances}`);
    }

    // Step 5: Delete user data in correct order (respecting foreign keys)
    console.log(`Starting deletion process for user ${userId}`);

    // Delete session data
    await supabase.from('user_sessions').delete().eq('user_id', userId);
    await supabase.from('user_2fa_preferences').delete().eq('user_id', userId);

    // Delete badges and ratings
    await supabase.from('user_badges').delete().eq('user_id', userId);
    await supabase.from('user_ratings').delete().or(`rated_by_user_id.eq.${userId},rated_user_id.eq.${userId}`);

    // Delete rewards
    await supabase.from('reward_activities').delete().eq('user_id', userId);
    await supabase.from('user_rewards').delete().eq('user_id', userId);

    // Delete virtual cards and transactions
    const { data: cards } = await supabase.from('virtual_cards').select('id').eq('user_id', userId);
    if (cards && cards.length > 0) {
      const cardIds = cards.map(c => c.id);
      await supabase.from('card_transactions').delete().in('card_id', cardIds);
    }
    await supabase.from('virtual_cards').delete().eq('user_id', userId);
    await supabase.from('virtual_card_poll').delete().eq('user_id', userId);

    // Delete marketplace data
    await supabase.from('marketplace_notifications').delete().eq('user_id', userId);
    const { data: listings } = await supabase.from('marketplace_listings').select('id').eq('seller_id', userId);
    if (listings && listings.length > 0) {
      const listingIds = listings.map(l => l.id);
      await supabase.from('marketplace_delivery_bids').delete().in('order_id', listingIds);
      await supabase.from('marketplace_bids').delete().in('listing_id', listingIds);
    }
    await supabase.from('marketplace_delivery_bids').delete().eq('rider_id', userId);
    await supabase.from('marketplace_bids').delete().eq('bidder_id', userId);

    // Delete order messages
    await supabase.from('order_messages').delete().eq('sender_id', userId);

    // Delete disputes
    await supabase.from('p2p_disputes').delete().eq('raised_by', userId);
    await supabase.from('disputes').delete().eq('user_id', userId);

    // Delete KYC (and storage files)
    const { data: kycData } = await supabase
      .from('kyc_verifications')
      .select('id_document_url, selfie_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (kycData) {
      // Delete storage files
      if (kycData.id_document_url) {
        const path = kycData.id_document_url.split('/kyc-documents/')[1];
        if (path) await supabase.storage.from('kyc-documents').remove([path]);
      }
      if (kycData.selfie_url) {
        const path = kycData.selfie_url.split('/kyc-documents/')[1];
        if (path) await supabase.storage.from('kyc-documents').remove([path]);
      }
    }
    await supabase.from('kyc_verifications').delete().eq('user_id', userId);

    // Delete payment methods and requests
    await supabase.from('payment_methods').delete().eq('user_id', userId);
    await supabase.from('payment_requests').delete().or(`requester_id.eq.${userId},payer_id.eq.${userId}`);

    // Delete staking
    await supabase.from('staking_positions').delete().eq('user_id', userId);

    // Delete wallet data
    await supabase.from('wallet_balances').delete().eq('user_id', userId);
    await supabase.from('wallet_sweeps').delete().eq('user_id', userId);
    await supabase.from('gas_fundings').delete().eq('user_id', userId);

    // Delete contacts
    await supabase.from('contact_invitations').delete().eq('inviter_id', userId);
    await supabase.from('contacts').delete().eq('user_id', userId);

    // Delete verification data
    await supabase.from('phone_verifications').delete().eq('phone_number', phoneNumber);
    await supabase.from('verification_attempts').delete().eq('phone_number', phoneNumber);
    await supabase.from('rate_limit_log').delete().eq('user_id', userId);

    // Anonymize transactions (don't delete for audit trail)
    await supabase
      .from('transactions')
      .update({ sender_id: null })
      .eq('sender_id', userId);
    await supabase
      .from('transactions')
      .update({ recipient_id: null })
      .eq('recipient_id', userId);

    // Delete P2P data
    await supabase.from('p2p_orders').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    await supabase.from('p2p_listings').delete().eq('user_id', userId);

    // Delete marketplace orders and listings
    await supabase.from('marketplace_orders').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    await supabase.from('marketplace_listings').delete().eq('seller_id', userId);

    // Delete roles and registry
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_registry').delete().eq('user_id', userId);

    // Delete profile (last, as others may reference it)
    await supabase.from('profiles').delete().eq('id', userId);

    // Step 6: Delete Supabase Auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return createErrorResponse('SERVER_ERROR', 'Failed to delete authentication account', corsHeaders);
    }

    console.log(`Successfully deleted user ${userId} (${phoneNumber})`);

    return createSuccessResponse({
      message: 'Account permanently deleted',
      userId,
      phoneNumber,
    }, corsHeaders);

  } catch (error) {
    console.error('Account deletion error:', error);
    return createErrorResponse('SERVER_ERROR', 'Failed to delete account', corsHeaders);
  }
});
