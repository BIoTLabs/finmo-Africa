-- Create payment requests table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'USDC',
  message text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL,
  paid_at timestamp with time zone,
  payer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create own payment requests"
ON public.payment_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own payment requests"
ON public.payment_requests
FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = payer_id);

CREATE POLICY "Users can update own payment requests"
ON public.payment_requests
FOR UPDATE
USING (auth.uid() = requester_id);

-- Public access to payment requests by ID (for payment page)
CREATE POLICY "Anyone can view payment request by ID"
ON public.payment_requests
FOR SELECT
USING (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_requester 
ON public.payment_requests(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status 
ON public.payment_requests(status, created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.payment_requests IS 'Payment requests sent via email to invite new users or request payments';
COMMENT ON COLUMN public.payment_requests.status IS 'Status: pending, paid, expired, cancelled';