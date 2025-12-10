-- Daily analytics summary table for efficient reporting
CREATE TABLE public.analytics_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_users integer DEFAULT 0,
  new_users integer DEFAULT 0,
  active_users integer DEFAULT 0,
  total_transactions integer DEFAULT 0,
  transaction_volume jsonb DEFAULT '{}',
  p2p_orders_count integer DEFAULT 0,
  p2p_volume jsonb DEFAULT '{}',
  marketplace_orders_count integer DEFAULT 0,
  marketplace_volume numeric DEFAULT 0,
  staking_new_positions integer DEFAULT 0,
  staking_total_value jsonb DEFAULT '{}',
  revenue_p2p numeric DEFAULT 0,
  revenue_marketplace numeric DEFAULT 0,
  revenue_withdrawal numeric DEFAULT 0,
  country_breakdown jsonb DEFAULT '{}',
  token_breakdown jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS: Admin only access
ALTER TABLE public.analytics_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics" ON public.analytics_daily_summary
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage analytics" ON public.analytics_daily_summary
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for date lookups
CREATE INDEX idx_analytics_daily_summary_date ON public.analytics_daily_summary(date DESC);