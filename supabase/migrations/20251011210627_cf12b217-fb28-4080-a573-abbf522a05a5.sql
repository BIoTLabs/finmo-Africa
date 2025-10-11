-- Create security definer function to check if user owns a listing
CREATE OR REPLACE FUNCTION public.is_listing_seller(_listing_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.marketplace_listings
    WHERE id = _listing_id
      AND seller_id = _user_id
  )
$$;

-- Drop and recreate the bid insertion policy
DROP POLICY IF EXISTS "Users can create bids on others' listings" ON marketplace_bids;

CREATE POLICY "Users can create bids on others' listings"
ON marketplace_bids
FOR INSERT
WITH CHECK (
  auth.uid() = bidder_id 
  AND NOT public.is_listing_seller(listing_id, auth.uid())
);