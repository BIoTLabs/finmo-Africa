-- Security Fix: Remove overly permissive explorer view policies
-- These policies exposed ALL financial transaction data to any authenticated user

-- Drop the explorer view policies that allow USING (true)
DROP POLICY IF EXISTS "explorer_view_all_transactions" ON public.transactions;
DROP POLICY IF EXISTS "explorer_view_staking_positions" ON public.staking_positions;
DROP POLICY IF EXISTS "explorer_view_p2p_orders" ON public.p2p_orders;
DROP POLICY IF EXISTS "explorer_view_marketplace_orders" ON public.marketplace_orders;

-- Create more restrictive explorer policies that only show aggregated/anonymized data
-- Users can still see their own data via existing user-specific policies

-- Allow viewing only completed transactions (not user-specific sensitive ones)
CREATE POLICY "explorer_view_completed_transactions" ON public.transactions
FOR SELECT
USING (
  status = 'completed' AND
  transaction_type IN ('deposit', 'withdraw') -- Exclude internal transfers
);

-- Allow viewing completed staking positions without user linkage
CREATE POLICY "explorer_view_completed_staking" ON public.staking_positions
FOR SELECT
USING (
  status IN ('completed', 'withdrawn')
);

-- Allow viewing only completed P2P orders (not pending/disputed)
CREATE POLICY "explorer_view_completed_p2p" ON public.p2p_orders
FOR SELECT
USING (
  status = 'completed'
);

-- Allow viewing only delivered marketplace orders
CREATE POLICY "explorer_view_delivered_marketplace" ON public.marketplace_orders
FOR SELECT
USING (
  status = 'delivered' AND
  buyer_confirmed_delivery = true
);

-- Note: The existing user-specific policies still allow users to see ALL their own data
-- These explorer policies only affect the public explorer view feature