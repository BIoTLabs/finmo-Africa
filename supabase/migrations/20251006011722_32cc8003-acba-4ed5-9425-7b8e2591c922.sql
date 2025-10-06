-- Phase 2 Security Improvements (Fix for existing policy)

-- 1. Add rate limiting table for profile lookups
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ip text NOT NULL,
  action_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on rate limit log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists, then create
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limit_log;
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limit_log
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Create index for efficient rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_ip_action_time 
ON public.rate_limit_log(user_ip, action_type, created_at);

-- 2. Create function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_ip text,
  _action_type text,
  _max_requests integer DEFAULT 10,
  _time_window_minutes integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count integer;
BEGIN
  SELECT COUNT(*)
  INTO request_count
  FROM public.rate_limit_log
  WHERE user_ip = _user_ip
    AND action_type = _action_type
    AND created_at > (now() - (_time_window_minutes || ' minutes')::interval);
  
  IF request_count < _max_requests THEN
    INSERT INTO public.rate_limit_log (user_ip, action_type, user_id)
    VALUES (_user_ip, _action_type, auth.uid());
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 3. Add columns for hashed phone numbers in contact_invitations
ALTER TABLE public.contact_invitations
ADD COLUMN IF NOT EXISTS contact_phone_hash text;

CREATE INDEX IF NOT EXISTS idx_contact_invitations_phone_hash 
ON public.contact_invitations(contact_phone_hash);

-- 4. Create function to hash phone numbers
CREATE OR REPLACE FUNCTION public.hash_phone_number(_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    digest(_phone || COALESCE(current_setting('app.phone_salt', true), 'default-salt'), 'sha256'),
    'hex'
  );
END;
$$;

-- 5. Add trigger to hash phone numbers
CREATE OR REPLACE FUNCTION public.hash_contact_phone_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.contact_phone_hash := public.hash_phone_number(NEW.contact_phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_hash_contact_phone ON public.contact_invitations;
CREATE TRIGGER trigger_hash_contact_phone
BEFORE INSERT ON public.contact_invitations
FOR EACH ROW
EXECUTE FUNCTION public.hash_contact_phone_on_insert();

-- 6. Add evidence access control for disputes
ALTER TABLE public.p2p_disputes
ADD COLUMN IF NOT EXISTS evidence_access_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_only_evidence boolean DEFAULT false;

-- 7. Create evidence access function
CREATE OR REPLACE FUNCTION public.can_access_dispute_evidence(
  _dispute_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dispute_record RECORD;
  is_admin boolean;
BEGIN
  is_admin := has_role(_user_id, 'admin'::app_role);
  
  SELECT * INTO dispute_record
  FROM public.p2p_disputes
  WHERE id = _dispute_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  IF dispute_record.admin_only_evidence THEN
    RETURN false;
  END IF;
  
  IF dispute_record.evidence_access_expires_at IS NOT NULL 
     AND dispute_record.evidence_access_expires_at < now() THEN
    RETURN false;
  END IF;
  
  RETURN dispute_record.raised_by = _user_id
    OR _user_id IN (
      SELECT buyer_id FROM public.p2p_orders WHERE id = dispute_record.order_id
      UNION
      SELECT seller_id FROM public.p2p_orders WHERE id = dispute_record.order_id
    );
END;
$$;