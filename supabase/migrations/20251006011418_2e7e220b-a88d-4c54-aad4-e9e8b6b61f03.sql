-- Fix security definer view issue
-- The view doesn't need SECURITY DEFINER since it's just filtering columns
-- Recreate without SECURITY DEFINER

DROP VIEW IF EXISTS public.p2p_listings_public;

-- Create view without security definer (normal view)
CREATE VIEW public.p2p_listings_public AS
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