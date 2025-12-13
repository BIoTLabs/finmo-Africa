-- Fix conflicting RLS policies by dropping restrictive "Block anonymous access" policies
-- and ensuring admin SELECT policies work properly

-- Drop conflicting policies that block admin access
DROP POLICY IF EXISTS "Block anonymous access to p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON profiles;
DROP POLICY IF EXISTS "Block anonymous access to staking_positions" ON staking_positions;
DROP POLICY IF EXISTS "Block anonymous access to transactions" ON transactions;

-- Drop and recreate admin analytics policies to ensure they're permissive
DROP POLICY IF EXISTS "Admins can view all profiles for analytics" ON profiles;
DROP POLICY IF EXISTS "Admins can view all transactions for analytics" ON transactions;
DROP POLICY IF EXISTS "Admins can view all staking positions for analytics" ON staking_positions;
DROP POLICY IF EXISTS "Admins can view all p2p orders for analytics" ON p2p_orders;
DROP POLICY IF EXISTS "Admins can view all marketplace orders for analytics" ON marketplace_orders;

-- Create permissive admin SELECT policies
CREATE POLICY "Admins can view all profiles for analytics" ON profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all transactions for analytics" ON transactions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all staking positions for analytics" ON staking_positions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all p2p orders for analytics" ON p2p_orders
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all marketplace orders for analytics" ON marketplace_orders
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));