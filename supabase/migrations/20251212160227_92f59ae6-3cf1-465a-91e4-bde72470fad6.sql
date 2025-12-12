-- Add RLS policies for admins to view all data needed for analytics

-- Allow admins to view all profiles for user analytics
CREATE POLICY "Admins can view all profiles for analytics" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all transactions for analytics
CREATE POLICY "Admins can view all transactions for analytics" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all staking positions for analytics
CREATE POLICY "Admins can view all staking positions for analytics" 
ON public.staking_positions 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all P2P orders for analytics
CREATE POLICY "Admins can view all p2p orders for analytics" 
ON public.p2p_orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all marketplace orders for analytics
CREATE POLICY "Admins can view all marketplace orders for analytics" 
ON public.marketplace_orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));