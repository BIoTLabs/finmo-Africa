-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view user registry" ON public.user_registry;

-- Add policy for users to view only their own registry entry
CREATE POLICY "Users can view own registry entry"
ON public.user_registry
FOR SELECT
USING (auth.uid() = user_id);

-- Create a secure function to lookup users by phone number
-- This prevents bulk data exposure while allowing legitimate lookups
CREATE OR REPLACE FUNCTION public.lookup_user_by_phone(phone TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return wallet_address and user_id for a specific phone number
  -- This prevents exposing all phone numbers in the database
  RETURN QUERY
  SELECT ur.wallet_address, ur.user_id
  FROM public.user_registry ur
  WHERE ur.phone_number = phone
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_user_by_phone(TEXT) TO authenticated;