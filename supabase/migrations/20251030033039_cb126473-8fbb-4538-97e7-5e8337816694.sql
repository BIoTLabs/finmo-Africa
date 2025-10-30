-- Fix hash_phone_number to use fully qualified function names from extensions schema
CREATE OR REPLACE FUNCTION public.hash_phone_number(_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Use digest from extensions schema
  RETURN encode(
    extensions.digest(
      (_phone || COALESCE(current_setting('app.phone_salt', true), 'default-salt'))::bytea,
      'sha256'
    ),
    'hex'
  );
END;
$$;

-- Test the function works
SELECT public.hash_phone_number('+1234567890') as test_result;