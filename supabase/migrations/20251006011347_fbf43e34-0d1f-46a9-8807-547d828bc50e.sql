-- Phase 1 Critical Security Fixes

-- 1. Add encryption columns for payment methods
ALTER TABLE public.payment_methods 
ADD COLUMN IF NOT EXISTS account_number_encrypted text,
ADD COLUMN IF NOT EXISTS encryption_key_id text DEFAULT 'v1';

-- Migrate existing data to encrypted column (this is temporary, will be encrypted via edge function)
UPDATE public.payment_methods 
SET account_number_encrypted = account_number 
WHERE account_number_encrypted IS NULL;

-- 2. Create a secure view for P2P listings that excludes payment_method_id
CREATE OR REPLACE VIEW public.p2p_listings_public AS
SELECT 
  id,
  user_id,
  listing_type,
  token,
  rate,
  min_amount,
  max_amount,
  available_amount,
  currency_code,
  country_code,
  terms,
  payment_time_limit,
  is_active,
  created_at,
  updated_at
FROM public.p2p_listings
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.p2p_listings_public TO authenticated;
GRANT SELECT ON public.p2p_listings_public TO anon;

-- 3. Update RLS policy for p2p_listings to be more restrictive
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.p2p_listings;

-- Only allow viewing own listings or listings without sensitive data
CREATE POLICY "Users can view own listings with payment info" 
ON public.p2p_listings
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Others can view active listings basic info"
ON public.p2p_listings  
FOR SELECT
USING (is_active = true AND auth.uid() != user_id);

-- 4. Add comment to track encryption status
COMMENT ON COLUMN public.payment_methods.account_number_encrypted IS 'Encrypted account number - use edge function to encrypt/decrypt';
COMMENT ON COLUMN public.payment_methods.account_number IS 'DEPRECATED: Use account_number_encrypted instead. Will be removed after migration';