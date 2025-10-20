-- Add encrypted user wallet private keys to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wallet_private_key_encrypted text,
ADD COLUMN IF NOT EXISTS encryption_key_version text DEFAULT 'v1';

-- Create table to track wallet sweeps
CREATE TABLE IF NOT EXISTS public.wallet_sweeps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_wallet_address text NOT NULL,
  master_wallet_address text NOT NULL,
  token text NOT NULL,
  amount numeric NOT NULL,
  sweep_tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.wallet_sweeps ENABLE ROW LEVEL SECURITY;

-- Admins can view all sweeps
CREATE POLICY "Admins can view all sweeps" ON public.wallet_sweeps
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own sweeps
CREATE POLICY "Users can view own sweeps" ON public.wallet_sweeps
FOR SELECT USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_user_id ON public.wallet_sweeps(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_status ON public.wallet_sweeps(status);