-- ============================================
-- PHASE 1: STAKING POOLS TABLE
-- ============================================

CREATE TABLE public.staking_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  apy_rate numeric NOT NULL,
  min_stake numeric NOT NULL DEFAULT 10,
  max_stake numeric DEFAULT NULL,
  lock_period_days integer NOT NULL,
  total_staked numeric NOT NULL DEFAULT 0,
  pool_capacity numeric DEFAULT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.staking_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active staking pools"
ON public.staking_pools FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage staking pools"
ON public.staking_pools FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- PHASE 2: PLATFORM WALLETS & REVENUE TABLES
-- ============================================

CREATE TABLE public.platform_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_type text NOT NULL UNIQUE,
  wallet_address text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  token text NOT NULL DEFAULT 'USDC',
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform wallets"
ON public.platform_wallets FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage platform wallets"
ON public.platform_wallets FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_type text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'USDC',
  source_order_id uuid,
  source_type text,
  wallet_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform revenue"
ON public.platform_revenue FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert platform revenue"
ON public.platform_revenue FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================
-- PHASE 3: MARKETPLACE CREDITS & PROMOTIONS
-- ============================================

CREATE TABLE public.user_listing_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  free_listings_used integer NOT NULL DEFAULT 0,
  free_listings_limit integer NOT NULL DEFAULT 1,
  purchased_credits integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_listing_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
ON public.user_listing_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
ON public.user_listing_credits FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE TABLE public.marketplace_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  promotion_tier text NOT NULL,
  amount_paid numeric NOT NULL,
  token text NOT NULL DEFAULT 'USDC',
  starts_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.marketplace_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own promotions"
ON public.marketplace_promotions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active promotions"
ON public.marketplace_promotions FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can create own promotions"
ON public.marketplace_promotions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PHASE 4: ALTER EXISTING TABLES
-- ============================================

-- Add promotion fields to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS is_promoted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_tier text,
ADD COLUMN IF NOT EXISTS promotion_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS listing_fee_paid numeric DEFAULT 0;

-- Add platform fee columns to p2p_orders
ALTER TABLE public.p2p_orders
ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_token text DEFAULT 'USDC',
ADD COLUMN IF NOT EXISTS fee_paid_by text DEFAULT 'seller';

-- ============================================
-- PHASE 5: STAKING RESERVES TRACKING
-- ============================================

CREATE TABLE public.staking_reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  total_staked numeric NOT NULL DEFAULT 0,
  pending_rewards numeric NOT NULL DEFAULT 0,
  reserve_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.staking_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view staking reserves"
ON public.staking_reserves FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage staking reserves"
ON public.staking_reserves FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================
-- PHASE 6: ADMIN REVENUE WITHDRAWALS TRACKING
-- ============================================

CREATE TABLE public.admin_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  wallet_type text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'USDC',
  destination_address text NOT NULL,
  transaction_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE public.admin_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all withdrawals"
ON public.admin_withdrawals FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create withdrawals"
ON public.admin_withdrawals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage withdrawals"
ON public.admin_withdrawals FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================
-- PHASE 7: UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================

CREATE TRIGGER update_staking_pools_updated_at
BEFORE UPDATE ON public.staking_pools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_wallets_updated_at
BEFORE UPDATE ON public.platform_wallets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_listing_credits_updated_at
BEFORE UPDATE ON public.user_listing_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staking_reserves_updated_at
BEFORE UPDATE ON public.staking_reserves
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();