-- Fix RLS policies for user_badges and cold_wallet_transfers

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view badges for public profiles" ON user_badges;
DROP POLICY IF EXISTS "Anyone can view cold wallet transfers" ON cold_wallet_transfers;

-- Create secure policy for user_badges - users can only see their own badges
CREATE POLICY "Users can view own badges only" 
ON user_badges FOR SELECT 
USING (auth.uid() = user_id);

-- Create secure policy for cold_wallet_transfers - admins only
CREATE POLICY "Admins can view cold wallet transfers" 
ON cold_wallet_transfers FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Link partners to auth users for proper authentication
-- Add user_id column to partners table to link partner accounts to authenticated users
ALTER TABLE partners ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);

-- Update RLS policy for partners to allow users to see their own partner record
DROP POLICY IF EXISTS "Users can view own partner record" ON partners;
CREATE POLICY "Users can view own partner record" 
ON partners FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Allow users to update their own partner record
DROP POLICY IF EXISTS "Users can update own partner record" ON partners;
CREATE POLICY "Users can update own partner record" 
ON partners FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Update partner_subscriptions RLS to allow partners to view their own subscription
DROP POLICY IF EXISTS "Partners can view own subscription" ON partner_subscriptions;
CREATE POLICY "Partners can view own subscription" 
ON partner_subscriptions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM partners 
    WHERE partners.id = partner_subscriptions.partner_id 
    AND partners.user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update partner_api_keys RLS to allow partners to view their own API keys
DROP POLICY IF EXISTS "Partners can view own API keys" ON partner_api_keys;
CREATE POLICY "Partners can view own API keys" 
ON partner_api_keys FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM partners 
    WHERE partners.id = partner_api_keys.partner_id 
    AND partners.user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update subscription_payments RLS to allow partners to view their own payments
DROP POLICY IF EXISTS "Partners can view own payments" ON subscription_payments;
CREATE POLICY "Partners can view own payments" 
ON subscription_payments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM partners 
    WHERE partners.id = subscription_payments.partner_id 
    AND partners.user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create function to get partner_id for authenticated user
CREATE OR REPLACE FUNCTION get_partner_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM partners WHERE user_id = _user_id LIMIT 1
$$;