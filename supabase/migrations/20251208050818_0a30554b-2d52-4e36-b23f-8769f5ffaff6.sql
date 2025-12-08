-- Partner Escrows table for marketplace transactions
CREATE TABLE public.partner_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) NOT NULL,
  buyer_wallet_id UUID REFERENCES public.partner_wallets(id) NOT NULL,
  seller_wallet_id UUID REFERENCES public.partner_wallets(id),
  amount NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  token TEXT NOT NULL DEFAULT 'USDC',
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'funded', 'released', 'disputed', 'refunded', 'expired')),
  external_reference TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner Cards table
CREATE TABLE public.partner_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) NOT NULL,
  wallet_id UUID REFERENCES public.partner_wallets(id) NOT NULL,
  external_customer_id TEXT NOT NULL,
  card_number_encrypted TEXT NOT NULL,
  cvv_encrypted TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  card_holder_name TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  spending_limit NUMERIC DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  is_frozen BOOLEAN DEFAULT false,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner Card Transactions table
CREATE TABLE public.partner_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.partner_cards(id) NOT NULL,
  partner_id UUID REFERENCES public.partners(id) NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('fund', 'purchase', 'refund', 'withdrawal')),
  merchant_name TEXT,
  merchant_category TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner KYC Verifications table
CREATE TABLE public.partner_kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) NOT NULL,
  external_customer_id TEXT NOT NULL,
  verification_level TEXT DEFAULT 'basic' CHECK (verification_level IN ('basic', 'standard', 'enhanced')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  nationality TEXT,
  address TEXT,
  document_type TEXT,
  document_number_encrypted TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  reviewed_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner IP Whitelist table
CREATE TABLE public.partner_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.partner_api_keys(id) ON DELETE CASCADE NOT NULL,
  ip_address INET NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_id, ip_address)
);

-- Partner FX Quotes table for quote locking
CREATE TABLE public.partner_fx_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  converted_amount NUMERIC NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.partner_escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_fx_quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_escrows
CREATE POLICY "Admins can view all escrows" ON public.partner_escrows FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage escrows" ON public.partner_escrows FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_cards
CREATE POLICY "Admins can view all partner cards" ON public.partner_cards FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage partner cards" ON public.partner_cards FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_card_transactions
CREATE POLICY "Admins can view all card transactions" ON public.partner_card_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage card transactions" ON public.partner_card_transactions FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_kyc_verifications
CREATE POLICY "Admins can view all KYC verifications" ON public.partner_kyc_verifications FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update KYC verifications" ON public.partner_kyc_verifications FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage KYC verifications" ON public.partner_kyc_verifications FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_ip_whitelist
CREATE POLICY "Admins can manage IP whitelist" ON public.partner_ip_whitelist FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage IP whitelist" ON public.partner_ip_whitelist FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- RLS Policies for partner_fx_quotes
CREATE POLICY "Service role can manage FX quotes" ON public.partner_fx_quotes FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Add webhook retry columns to partner_webhook_logs
ALTER TABLE public.partner_webhook_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.partner_webhook_logs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.partner_webhook_logs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 5;
ALTER TABLE public.partner_webhook_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed'));

-- Create indexes for performance
CREATE INDEX idx_partner_escrows_partner_id ON public.partner_escrows(partner_id);
CREATE INDEX idx_partner_escrows_status ON public.partner_escrows(status);
CREATE INDEX idx_partner_cards_partner_id ON public.partner_cards(partner_id);
CREATE INDEX idx_partner_cards_external_customer ON public.partner_cards(external_customer_id);
CREATE INDEX idx_partner_card_transactions_card_id ON public.partner_card_transactions(card_id);
CREATE INDEX idx_partner_kyc_partner_id ON public.partner_kyc_verifications(partner_id);
CREATE INDEX idx_partner_kyc_external_customer ON public.partner_kyc_verifications(external_customer_id);
CREATE INDEX idx_partner_ip_whitelist_api_key ON public.partner_ip_whitelist(api_key_id);
CREATE INDEX idx_partner_fx_quotes_partner_id ON public.partner_fx_quotes(partner_id);
CREATE INDEX idx_partner_fx_quotes_expires_at ON public.partner_fx_quotes(expires_at);

-- Update trigger for updated_at columns
CREATE TRIGGER update_partner_escrows_updated_at BEFORE UPDATE ON public.partner_escrows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_cards_updated_at BEFORE UPDATE ON public.partner_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_kyc_updated_at BEFORE UPDATE ON public.partner_kyc_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();