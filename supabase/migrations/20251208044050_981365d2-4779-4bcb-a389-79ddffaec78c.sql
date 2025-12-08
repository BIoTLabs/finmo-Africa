-- Partner Organizations
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  business_type TEXT, -- 'bank', 'mobile_money', 'fintech', 'corporate', 'startup'
  country_code TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'suspended', 'rejected'
  api_tier TEXT DEFAULT 'free', -- 'free', 'growth', 'enterprise'
  sandbox_enabled BOOLEAN DEFAULT true,
  production_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- API Keys (multiple per partner)
CREATE TABLE public.partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., "pk_live_")
  name TEXT, -- Friendly name for the key
  environment TEXT DEFAULT 'sandbox', -- 'sandbox' or 'production'
  scopes TEXT[] DEFAULT ARRAY['wallets:read', 'transfers:read'], -- Permissions
  rate_limit_per_minute INTEGER DEFAULT 60,
  daily_request_limit INTEGER DEFAULT 10000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner Sub-Wallets (wallets created on behalf of partner customers)
CREATE TABLE public.partner_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  external_customer_id TEXT NOT NULL, -- Partner's customer ID
  wallet_address TEXT UNIQUE,
  wallet_private_key_encrypted TEXT,
  label TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, external_customer_id)
);

-- Partner Wallet Balances
CREATE TABLE public.partner_wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.partner_wallets(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wallet_id, token)
);

-- Partner Transactions
CREATE TABLE public.partner_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  source_wallet_id UUID REFERENCES public.partner_wallets(id),
  destination_wallet_id UUID REFERENCES public.partner_wallets(id),
  external_reference TEXT, -- Partner's reference ID
  transaction_type TEXT NOT NULL, -- 'internal', 'deposit', 'withdrawal', 'payout'
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  fee NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  blockchain_tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Partner Webhooks Configuration
CREATE TABLE public.partner_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- ['wallet.created', 'transfer.completed', etc.]
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner Webhook Delivery Logs
CREATE TABLE public.partner_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.partner_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Usage Logs
CREATE TABLE public.partner_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  api_key_id UUID REFERENCES public.partner_api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_partner_api_keys_hash ON public.partner_api_keys(key_hash);
CREATE INDEX idx_partner_api_keys_partner ON public.partner_api_keys(partner_id);
CREATE INDEX idx_partner_wallets_partner ON public.partner_wallets(partner_id);
CREATE INDEX idx_partner_wallets_address ON public.partner_wallets(wallet_address);
CREATE INDEX idx_partner_transactions_partner ON public.partner_transactions(partner_id);
CREATE INDEX idx_partner_transactions_created ON public.partner_transactions(created_at DESC);
CREATE INDEX idx_partner_api_logs_partner ON public.partner_api_logs(partner_id);
CREATE INDEX idx_partner_api_logs_created ON public.partner_api_logs(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners table
CREATE POLICY "Admins can manage all partners" ON public.partners
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage partners" ON public.partners
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_api_keys
CREATE POLICY "Admins can manage all API keys" ON public.partner_api_keys
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage API keys" ON public.partner_api_keys
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_wallets
CREATE POLICY "Admins can view all partner wallets" ON public.partner_wallets
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage partner wallets" ON public.partner_wallets
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_wallet_balances
CREATE POLICY "Admins can view all partner wallet balances" ON public.partner_wallet_balances
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage partner wallet balances" ON public.partner_wallet_balances
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_transactions
CREATE POLICY "Admins can view all partner transactions" ON public.partner_transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage partner transactions" ON public.partner_transactions
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_webhooks
CREATE POLICY "Admins can manage all webhooks" ON public.partner_webhooks
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage webhooks" ON public.partner_webhooks
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_webhook_logs
CREATE POLICY "Admins can view all webhook logs" ON public.partner_webhook_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage webhook logs" ON public.partner_webhook_logs
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_api_logs
CREATE POLICY "Admins can view all API logs" ON public.partner_api_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage API logs" ON public.partner_api_logs
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'pk_' || encode(gen_random_bytes(24), 'hex');
END;
$$;

-- Function to hash API key
CREATE OR REPLACE FUNCTION public.hash_api_key(_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.digest(_key::bytea, 'sha256'), 'hex');
END;
$$;

-- Updated at trigger for partners
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Updated at trigger for partner_wallets
CREATE TRIGGER update_partner_wallets_updated_at
  BEFORE UPDATE ON public.partner_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Updated at trigger for partner_wallet_balances
CREATE TRIGGER update_partner_wallet_balances_updated_at
  BEFORE UPDATE ON public.partner_wallet_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();