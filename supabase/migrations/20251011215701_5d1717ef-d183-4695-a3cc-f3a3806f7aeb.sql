-- Fix 1: Remove overly permissive payment request policy
DROP POLICY IF EXISTS "Anyone can view payment request by ID" ON public.payment_requests;

-- Fix 2: Create atomic transaction function with proper locking to prevent double spending
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  _sender_id uuid,
  _recipient_id uuid,
  _amount numeric,
  _token text,
  _sender_wallet text,
  _recipient_wallet text,
  _transaction_type text DEFAULT 'internal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transaction_id uuid;
  _sender_balance numeric;
BEGIN
  -- Validate inputs
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  
  IF _amount > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum limit';
  END IF;
  
  -- Lock the sender's balance row FOR UPDATE to prevent race conditions
  SELECT balance INTO _sender_balance
  FROM public.wallet_balances
  WHERE user_id = _sender_id AND token = _token
  FOR UPDATE;
  
  -- Check balance
  IF _sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;
  
  IF _sender_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from sender atomically
  UPDATE public.wallet_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _sender_id AND token = _token;
  
  -- Add to recipient with UPSERT (handles if recipient doesn't have wallet yet)
  INSERT INTO public.wallet_balances (user_id, token, balance)
  VALUES (_recipient_id, _token, _amount)
  ON CONFLICT (user_id, token)
  DO UPDATE SET balance = wallet_balances.balance + _amount, updated_at = now();
  
  -- Create transaction record
  INSERT INTO public.transactions (
    sender_id, recipient_id, sender_wallet, recipient_wallet,
    amount, token, transaction_type, status
  ) VALUES (
    _sender_id, _recipient_id, _sender_wallet, _recipient_wallet,
    _amount, _token, _transaction_type, 'completed'
  ) RETURNING id INTO _transaction_id;
  
  RETURN _transaction_id;
END;
$$;

-- Create a function for secure payment request viewing (for public payment page)
CREATE OR REPLACE FUNCTION public.get_payment_request_public_info(_request_id uuid)
RETURNS TABLE(
  id uuid,
  amount numeric,
  token text,
  message text,
  status text,
  expires_at timestamp with time zone,
  requester_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.amount,
    pr.token,
    pr.message,
    pr.status,
    pr.expires_at,
    COALESCE(p.display_name, p.phone_number, 'FinMo User') as requester_name
  FROM public.payment_requests pr
  LEFT JOIN public.profiles p ON p.id = pr.requester_id
  WHERE pr.id = _request_id;
END;
$$;