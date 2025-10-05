-- Fix the handle_new_user function to handle conflicts properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_wallet_address TEXT;
  phone_num TEXT;
BEGIN
  -- Generate wallet address
  new_wallet_address := generate_wallet_address();
  
  -- Extract phone number from metadata
  phone_num := NEW.raw_user_meta_data->>'phone_number';
  
  -- Insert into profiles (or update if exists)
  INSERT INTO public.profiles (id, phone_number, wallet_address)
  VALUES (NEW.id, phone_num, new_wallet_address)
  ON CONFLICT (id) DO UPDATE
  SET phone_number = EXCLUDED.phone_number,
      wallet_address = EXCLUDED.wallet_address;
  
  -- Insert into user_registry (or update if exists)
  INSERT INTO public.user_registry (phone_number, wallet_address, user_id)
  VALUES (phone_num, new_wallet_address, NEW.id)
  ON CONFLICT (phone_number) DO UPDATE
  SET wallet_address = EXCLUDED.wallet_address,
      user_id = EXCLUDED.user_id;
  
  RETURN NEW;
END;
$function$;