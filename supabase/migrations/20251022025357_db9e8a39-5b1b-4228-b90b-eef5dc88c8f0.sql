-- Create cold_wallet_transfers table to track admin withdrawals from hot wallet
CREATE TABLE IF NOT EXISTS public.cold_wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  hot_wallet_address TEXT NOT NULL,
  cold_wallet_address TEXT NOT NULL,
  token TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.cold_wallet_transfers ENABLE ROW LEVEL SECURITY;

-- Admins can insert cold wallet transfers
CREATE POLICY "Admins can create cold wallet transfers"
ON public.cold_wallet_transfers
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update cold wallet transfers
CREATE POLICY "Admins can update cold wallet transfers"
ON public.cold_wallet_transfers
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view cold wallet transfers for transparency
CREATE POLICY "Anyone can view cold wallet transfers"
ON public.cold_wallet_transfers
FOR SELECT
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX idx_cold_wallet_transfers_created_at ON public.cold_wallet_transfers(created_at DESC);
CREATE INDEX idx_cold_wallet_transfers_token ON public.cold_wallet_transfers(token);
CREATE INDEX idx_cold_wallet_transfers_status ON public.cold_wallet_transfers(status);