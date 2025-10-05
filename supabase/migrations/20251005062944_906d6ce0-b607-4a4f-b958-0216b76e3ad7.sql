-- Recreate the generate_wallet_address function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_wallet_address()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN '0x' || encode(gen_random_bytes(20), 'hex');
END;
$$;