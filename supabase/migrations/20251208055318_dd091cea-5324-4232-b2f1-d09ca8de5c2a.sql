-- Create subscription_tiers table
CREATE TABLE public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  monthly_fee_usdt NUMERIC NOT NULL DEFAULT 0,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 30,
  daily_api_limit INTEGER,
  monthly_api_limit INTEGER,
  max_api_keys INTEGER NOT NULL DEFAULT 2,
  production_access BOOLEAN NOT NULL DEFAULT false,
  features JSONB DEFAULT '[]'::jsonb,
  transaction_fees JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers (for pricing page)
CREATE POLICY "Anyone can view active subscription tiers"
ON public.subscription_tiers FOR SELECT
USING (is_active = true);

-- Admins can manage tiers
CREATE POLICY "Admins can manage subscription tiers"
ON public.subscription_tiers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default tiers
INSERT INTO public.subscription_tiers (name, display_name, monthly_fee_usdt, rate_limit_per_minute, daily_api_limit, monthly_api_limit, max_api_keys, production_access, features, transaction_fees, sort_order) VALUES
('free', 'Free', 0, 30, 500, 10000, 2, false, 
  '["Sandbox environment only", "2 API keys", "Community support", "Basic documentation"]'::jsonb,
  '{"transfers": null, "payins": null, "payouts_crypto": null, "payouts_fiat": null, "escrow": null, "cards": null}'::jsonb,
  1),
('starter', 'Starter', 49, 60, 2000, 50000, 5, true,
  '["Production access", "5 API keys", "Email support", "All API endpoints", "Webhook notifications"]'::jsonb,
  '{"transfers": 0.5, "payins": 0.5, "payouts_crypto": 0.75, "payouts_fiat": 1.5, "escrow": 1.0, "cards": 2.0}'::jsonb,
  2),
('growth', 'Growth', 199, 300, 20000, 500000, 10, true,
  '["Everything in Starter", "10 API keys", "Priority support", "Advanced analytics", "Batch operations", "Custom webhooks"]'::jsonb,
  '{"transfers": 0.3, "payins": 0.3, "payouts_crypto": 0.5, "payouts_fiat": 1.0, "escrow": 0.75, "cards": 1.5}'::jsonb,
  3),
('enterprise', 'Enterprise', 499, 1000, null, null, 25, true,
  '["Everything in Growth", "25 API keys", "Dedicated support", "Custom rate limits", "SLA guarantee", "IP whitelisting", "Priority processing"]'::jsonb,
  '{"transfers": 0.1, "payins": 0.1, "payouts_crypto": 0.25, "payouts_fiat": 0.75, "escrow": 0.5, "cards": 1.0}'::jsonb,
  4);

-- Create partner_subscriptions table
CREATE TABLE public.partner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  payment_wallet_address TEXT NOT NULL,
  amount_due NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id)
);

-- Enable RLS
ALTER TABLE public.partner_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins can view all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.partner_subscriptions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage subscriptions
CREATE POLICY "Service role can manage subscriptions"
ON public.partner_subscriptions FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create subscription_payments table
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.partner_subscriptions(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL CHECK (token IN ('USDT', 'USDC')),
  chain_id INTEGER NOT NULL,
  chain_name TEXT,
  tx_hash TEXT,
  from_wallet_address TEXT,
  to_wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Admins can view all payments
CREATE POLICY "Admins can view all subscription payments"
ON public.subscription_payments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage payments
CREATE POLICY "Service role can manage subscription payments"
ON public.subscription_payments FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create api_usage_logs table for tracking
CREATE TABLE public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  api_key_id UUID REFERENCES public.partner_api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_status INTEGER,
  response_time_ms INTEGER,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient usage counting
CREATE INDEX idx_api_usage_partner_date ON public.api_usage_logs(partner_id, request_date);
CREATE INDEX idx_api_usage_partner_month ON public.api_usage_logs(partner_id, created_at);

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all API usage logs"
ON public.api_usage_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage logs
CREATE POLICY "Service role can manage API usage logs"
ON public.api_usage_logs FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Add tier_id to partners table for quick reference
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS current_tier_id UUID REFERENCES public.subscription_tiers(id);

-- Set default tier to free for existing partners
UPDATE public.partners 
SET current_tier_id = (SELECT id FROM public.subscription_tiers WHERE name = 'free')
WHERE current_tier_id IS NULL;

-- Create function to check API usage limits
CREATE OR REPLACE FUNCTION public.check_api_usage_limit(
  _partner_id UUID,
  _daily_limit INTEGER,
  _monthly_limit INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  daily_count INTEGER;
  monthly_count INTEGER;
  result JSONB;
BEGIN
  -- Count today's requests
  SELECT COUNT(*) INTO daily_count
  FROM public.api_usage_logs
  WHERE partner_id = _partner_id
    AND request_date = CURRENT_DATE;
  
  -- Count this month's requests
  SELECT COUNT(*) INTO monthly_count
  FROM public.api_usage_logs
  WHERE partner_id = _partner_id
    AND created_at >= date_trunc('month', CURRENT_TIMESTAMP);
  
  -- Check limits
  IF _daily_limit IS NOT NULL AND daily_count >= _daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'daily_used', daily_count,
      'daily_limit', _daily_limit
    );
  END IF;
  
  IF _monthly_limit IS NOT NULL AND monthly_count >= _monthly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit_exceeded',
      'monthly_used', monthly_count,
      'monthly_limit', _monthly_limit
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'daily_used', daily_count,
    'daily_limit', _daily_limit,
    'monthly_used', monthly_count,
    'monthly_limit', _monthly_limit
  );
END;
$$;

-- Create function to get partner usage stats
CREATE OR REPLACE FUNCTION public.get_partner_usage_stats(_partner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  daily_count INTEGER;
  monthly_count INTEGER;
  tier_info RECORD;
BEGIN
  -- Get tier info
  SELECT st.* INTO tier_info
  FROM public.partners p
  JOIN public.subscription_tiers st ON st.id = p.current_tier_id
  WHERE p.id = _partner_id;
  
  -- Count today's requests
  SELECT COUNT(*) INTO daily_count
  FROM public.api_usage_logs
  WHERE partner_id = _partner_id
    AND request_date = CURRENT_DATE;
  
  -- Count this month's requests
  SELECT COUNT(*) INTO monthly_count
  FROM public.api_usage_logs
  WHERE partner_id = _partner_id
    AND created_at >= date_trunc('month', CURRENT_TIMESTAMP);
  
  RETURN jsonb_build_object(
    'tier_name', tier_info.name,
    'tier_display_name', tier_info.display_name,
    'daily_used', daily_count,
    'daily_limit', tier_info.daily_api_limit,
    'monthly_used', monthly_count,
    'monthly_limit', tier_info.monthly_api_limit,
    'rate_limit_per_minute', tier_info.rate_limit_per_minute
  );
END;
$$;