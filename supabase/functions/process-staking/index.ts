import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Request-Private-Network': 'false',
};

interface StakeRequest {
  action: 'create' | 'withdraw';
  token: string;
  amount?: number;
  duration_days?: number;
  stake_id?: string;
  pool_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const requestData: StakeRequest = await req.json();
    const { action, token, amount, duration_days, stake_id, pool_id } = requestData;

    console.log('Processing staking action:', { action, user: user.id, token });

    if (action === 'create') {
      // Validate inputs
      if (!amount || !duration_days) {
        throw new Error('Amount and duration are required for staking');
      }

      if (typeof amount !== 'number' || !isFinite(amount)) {
        throw new Error('Invalid amount');
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      // Fetch staking pool from database for this token and duration
      const { data: stakingPool, error: poolError } = await supabase
        .from('staking_pools')
        .select('*')
        .eq('token', token)
        .eq('lock_period_days', duration_days)
        .eq('is_active', true)
        .single();

      if (poolError || !stakingPool) {
        // Try to find any pool for this token
        const { data: availablePools } = await supabase
          .from('staking_pools')
          .select('lock_period_days')
          .eq('token', token)
          .eq('is_active', true);
        
        const durations = availablePools?.map(p => p.lock_period_days).join(', ') || 'none available';
        throw new Error(`No staking pool found for ${token} with ${duration_days} day duration. Available durations: ${durations}`);
      }

      // Validate amount against pool limits
      if (amount < stakingPool.min_stake) {
        throw new Error(`Minimum stake amount is ${stakingPool.min_stake} ${token}`);
      }

      if (stakingPool.max_stake && amount > stakingPool.max_stake) {
        throw new Error(`Maximum stake amount is ${stakingPool.max_stake} ${token}`);
      }

      // Check pool capacity
      if (stakingPool.pool_capacity) {
        const remainingCapacity = stakingPool.pool_capacity - stakingPool.total_staked;
        if (amount > remainingCapacity) {
          throw new Error(`Pool capacity exceeded. Available: ${remainingCapacity.toFixed(2)} ${token}`);
        }
      }

      // Lock user's balance row to prevent race conditions
      const { data: userBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', user.id)
        .eq('token', token)
        .single();

      if (balanceError || !userBalance) {
        console.error('Balance fetch failed:', balanceError);
        throw new Error('Unable to process staking request');
      }

      if (userBalance.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Use the APY from the pool
      const apyRate = stakingPool.apy_rate;

      // Calculate rewards
      const { data: estimatedRewards, error: rewardsError } = await supabase
        .rpc('calculate_staking_rewards', {
          _amount: amount,
          _apy_rate: apyRate,
          _duration_days: duration_days
        });

      if (rewardsError) {
        console.error('Rewards calculation failed:', rewardsError);
        throw new Error('Unable to calculate rewards');
      }

      // Calculate end date
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration_days);

      // Deduct from balance
      const { error: updateError } = await supabase
        .from('wallet_balances')
        .update({ balance: userBalance.balance - amount })
        .eq('user_id', user.id)
        .eq('token', token);

      if (updateError) {
        console.error('Balance update failed:', updateError);
        throw new Error('Unable to process staking request');
      }

      // Create staking position
      const { data: stakingPosition, error: stakingError } = await supabase
        .from('staking_positions')
        .insert({
          user_id: user.id,
          token: token,
          staked_amount: amount,
          duration_days: duration_days,
          apy_rate: apyRate,
          rewards_earned: 0,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (stakingError) {
        console.error('Staking creation failed:', stakingError);
        // Rollback balance deduction
        await supabase
          .from('wallet_balances')
          .update({ balance: userBalance.balance })
          .eq('user_id', user.id)
          .eq('token', token);
        throw new Error('Unable to create staking position');
      }

      // Update pool total staked
      await supabase
        .from('staking_pools')
        .update({ total_staked: stakingPool.total_staked + amount })
        .eq('id', stakingPool.id);

      // Update staking reserves
      await supabase
        .from('staking_reserves')
        .upsert({
          token: token,
          total_staked: stakingPool.total_staked + amount,
          pending_rewards: estimatedRewards,
          updated_at: new Date().toISOString()
        }, { onConflict: 'token' });

      console.log('Stake created:', stakingPosition.id);

      return new Response(
        JSON.stringify({
          success: true,
          stake_id: stakingPosition.id,
          estimated_rewards: estimatedRewards,
          apy_rate: apyRate,
          pool_id: stakingPool.id,
          message: `Successfully staked ${amount} ${token} at ${apyRate}% APY for ${duration_days} days!`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'withdraw') {
      if (!stake_id) {
        throw new Error('Stake ID is required for withdrawal');
      }

      // Get staking position
      const { data: stake, error: stakeError } = await supabase
        .from('staking_positions')
        .select('*')
        .eq('id', stake_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (stakeError || !stake) {
        console.error('Stake fetch failed:', stakeError);
        throw new Error('Staking position not found or already withdrawn');
      }

      const now = new Date();
      const endDate = new Date(stake.end_date);
      const isMatured = now >= endDate;

      // Calculate current rewards
      const daysElapsed = Math.min(
        Math.floor((now.getTime() - new Date(stake.start_date).getTime()) / (1000 * 60 * 60 * 24)),
        stake.duration_days
      );

      const { data: currentRewards, error: rewardsError } = await supabase
        .rpc('calculate_staking_rewards', {
          _amount: stake.staked_amount,
          _apy_rate: stake.apy_rate,
          _duration_days: daysElapsed
        });

      if (rewardsError) {
        console.error('Rewards calculation failed:', rewardsError);
        throw new Error('Unable to calculate rewards');
      }

      // Apply early withdrawal penalty if not matured (50% rewards reduction)
      const finalRewards = isMatured ? currentRewards : currentRewards * 0.5;
      const totalAmount = stake.staked_amount + finalRewards;

      // Return funds to balance
      const { data: currentBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', user.id)
        .eq('token', stake.token)
        .single();

      if (balanceError) {
        console.error('Balance fetch failed:', balanceError);
        throw new Error('Unable to process withdrawal');
      }

      const { error: updateBalanceError } = await supabase
        .from('wallet_balances')
        .update({ 
          balance: (currentBalance?.balance || 0) + totalAmount 
        })
        .eq('user_id', user.id)
        .eq('token', stake.token);

      if (updateBalanceError) {
        console.error('Balance update failed:', updateBalanceError);
        throw new Error('Unable to process withdrawal');
      }

      // Update staking position
      const { error: updateStakeError } = await supabase
        .from('staking_positions')
        .update({
          status: 'withdrawn',
          rewards_earned: finalRewards,
          withdrawn_at: now.toISOString()
        })
        .eq('id', stake_id);

      if (updateStakeError) {
        console.error('Stake update failed:', updateStakeError);
        // Rollback balance
        await supabase
          .from('wallet_balances')
          .update({ balance: currentBalance?.balance || 0 })
          .eq('user_id', user.id)
          .eq('token', stake.token);
        throw new Error('Unable to complete withdrawal');
      }

      // Update pool total staked
      const { data: pool } = await supabase
        .from('staking_pools')
        .select('id, total_staked')
        .eq('token', stake.token)
        .eq('lock_period_days', stake.duration_days)
        .single();

      if (pool) {
        await supabase
          .from('staking_pools')
          .update({ total_staked: Math.max(0, pool.total_staked - stake.staked_amount) })
          .eq('id', pool.id);
      }

      // Update staking reserves
      await supabase
        .from('staking_reserves')
        .update({
          total_staked: Math.max(0, (pool?.total_staked || stake.staked_amount) - stake.staked_amount),
          updated_at: new Date().toISOString()
        })
        .eq('token', stake.token);

      console.log('Withdrawal completed:', { stake_id, totalAmount, finalRewards });

      return new Response(
        JSON.stringify({
          success: true,
          staked_amount: stake.staked_amount,
          rewards_earned: finalRewards,
          total_returned: totalAmount,
          is_matured: isMatured,
          penalty_applied: !isMatured,
          message: isMatured 
            ? `Withdrawal completed! You received ${totalAmount.toFixed(4)} ${stake.token} (${stake.staked_amount} principal + ${finalRewards.toFixed(4)} rewards)` 
            : `Early withdrawal completed with 50% penalty. You received ${totalAmount.toFixed(4)} ${stake.token}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Staking error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    const userMessage = error instanceof Error && 
      ['Insufficient balance', 'Invalid duration', 'Invalid amount', 'Minimum stake amount',
       'Maximum stake amount', 'Pool capacity exceeded', 'No staking pool found',
       'Amount must be greater than zero', 'Staking position not found'].some(msg => error.message.includes(msg))
      ? error.message
      : 'Unable to process staking request. Please try again later.';
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});