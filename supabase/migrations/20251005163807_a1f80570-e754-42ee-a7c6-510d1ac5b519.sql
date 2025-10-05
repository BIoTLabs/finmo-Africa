-- Create admin settings table for platform configuration
CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admins can view all settings
CREATE POLICY "Admins can view all settings"
ON public.admin_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update settings
CREATE POLICY "Admins can update settings"
ON public.admin_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert settings
CREATE POLICY "Admins can insert settings"
ON public.admin_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default withdrawal fees
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES 
  ('withdrawal_fees', '{"USDC": 0.50, "MATIC": 0.02}'::jsonb),
  ('master_wallet_address', '"0x0000000000000000000000000000000000000000"'::jsonb);

-- Add withdrawal_fee column to transactions table
ALTER TABLE public.transactions
ADD COLUMN withdrawal_fee NUMERIC DEFAULT 0;