-- Create phone verification tracking table
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create verification attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  ip_address text,
  attempted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

-- Phone verifications policies
CREATE POLICY "Service role can manage phone verifications"
ON public.phone_verifications
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Verification attempts policies  
CREATE POLICY "Service role can manage verification attempts"
ON public.verification_attempts
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Add phone_verified_at to profiles metadata
COMMENT ON TABLE public.phone_verifications IS 'Tracks phone number OTP verifications for signup and recovery';
COMMENT ON TABLE public.verification_attempts IS 'Rate limiting for OTP requests';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON public.phone_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires ON public.phone_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_phone ON public.verification_attempts(phone_number, attempted_at);