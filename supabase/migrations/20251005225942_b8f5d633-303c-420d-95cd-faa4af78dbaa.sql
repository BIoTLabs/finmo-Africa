-- Update initialize_wallet_balances to set balances to 0 instead of dummy values
CREATE OR REPLACE FUNCTION public.initialize_wallet_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Initialize USDC balance to 0
  INSERT INTO public.wallet_balances (user_id, token, balance)
  VALUES (NEW.id, 'USDC', 0);
  
  -- Initialize MATIC balance to 0
  INSERT INTO public.wallet_balances (user_id, token, balance)
  VALUES (NEW.id, 'MATIC', 0);
  
  RETURN NEW;
END;
$$;