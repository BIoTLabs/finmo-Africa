-- Recreate hash_phone_number function with proper type casting for pgcrypto
CREATE OR REPLACE FUNCTION public.hash_phone_number(_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cast text to bytea for digest() function
  RETURN encode(
    digest(
      (_phone || COALESCE(current_setting('app.phone_salt', true), 'default-salt'))::bytea,
      'sha256'
    ),
    'hex'
  );
END;
$$;