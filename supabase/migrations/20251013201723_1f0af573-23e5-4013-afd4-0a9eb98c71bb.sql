-- Create enum for badge types
CREATE TYPE public.badge_type AS ENUM ('finmo_pioneer', 'volume_trader', 'steady_earner', 'kyc_verified', 'super_connector');

-- Create enum for activity types
CREATE TYPE public.reward_activity_type AS ENUM (
  'account_creation',
  'kyc_completion',
  'contact_sync',
  'user_invitation',
  'first_transaction',
  'transaction_volume',
  'transaction_frequency',
  'p2p_trade',
  'marketplace_purchase',
  'monthly_retention'
);

-- User rewards tracking table
CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  early_bird_points NUMERIC NOT NULL DEFAULT 0,
  activity_points NUMERIC NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  consecutive_active_months INTEGER NOT NULL DEFAULT 0,
  last_active_month DATE,
  total_transaction_volume NUMERIC NOT NULL DEFAULT 0,
  monthly_transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Activity log for reward tracking
CREATE TABLE public.reward_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type reward_activity_type NOT NULL,
  points_awarded NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User badges/NFTs
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type badge_type NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_image_url TEXT,
  nft_token_id TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

-- Reward rules configuration
CREATE TABLE public.reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type reward_activity_type NOT NULL UNIQUE,
  points_base NUMERIC NOT NULL,
  points_multiplier NUMERIC DEFAULT 1.0,
  max_points_per_period NUMERIC,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_rewards
CREATE POLICY "Users can view own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards"
  ON public.user_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards"
  ON public.user_rewards FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for reward_activities
CREATE POLICY "Users can view own activities"
  ON public.reward_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
  ON public.reward_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_badges
CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view badges for public profiles"
  ON public.user_badges FOR SELECT
  USING (true);

-- RLS Policies for reward_rules
CREATE POLICY "Anyone can view reward rules"
  ON public.reward_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage reward rules"
  ON public.reward_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Insert default reward rules
INSERT INTO public.reward_rules (activity_type, points_base, max_points_per_period, metadata) VALUES
  ('account_creation', 100, 100, '{"description": "Welcome bonus for creating account"}'),
  ('kyc_completion', 200, 200, '{"description": "KYC verification bonus"}'),
  ('contact_sync', 50, 50, '{"description": "First contact sync bonus"}'),
  ('user_invitation', 25, 500, '{"description": "Points per invited user, max 500"}'),
  ('first_transaction', 150, 150, '{"description": "First transaction bonus"}'),
  ('transaction_volume', 1, NULL, '{"description": "1 point per $1 volume"}'),
  ('transaction_frequency', 10, 300, '{"description": "10 points per transaction, max 300/month"}'),
  ('p2p_trade', 20, 400, '{"description": "20 points per P2P trade, max 400/month"}'),
  ('marketplace_purchase', 30, 500, '{"description": "30 points per marketplace purchase, max 500/month"}'),
  ('monthly_retention', 100, NULL, '{"description": "100 points per consecutive active month"}');

-- Function to initialize user rewards
CREATE OR REPLACE FUNCTION public.initialize_user_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_rewards (user_id, early_bird_points, total_points)
  VALUES (NEW.id, 100, 100);
  
  INSERT INTO public.reward_activities (user_id, activity_type, points_awarded)
  VALUES (NEW.id, 'account_creation', 100);
  
  RETURN NEW;
END;
$$;

-- Trigger for account creation rewards
CREATE TRIGGER on_user_created_reward
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_rewards();

-- Function to award points
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id UUID,
  _activity_type reward_activity_type,
  _metadata JSONB DEFAULT '{}'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _points NUMERIC;
  _rule RECORD;
  _current_rewards RECORD;
  _is_early_bird BOOLEAN := false;
BEGIN
  -- Get reward rule
  SELECT * INTO _rule FROM public.reward_rules 
  WHERE activity_type = _activity_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate points
  _points := _rule.points_base;
  
  -- Apply multiplier if in metadata
  IF _metadata ? 'multiplier' THEN
    _points := _points * (_metadata->>'multiplier')::NUMERIC;
  END IF;
  
  -- Check if early bird activity
  IF _activity_type IN ('account_creation', 'kyc_completion', 'contact_sync', 'user_invitation') THEN
    _is_early_bird := true;
  END IF;
  
  -- Get current rewards
  SELECT * INTO _current_rewards FROM public.user_rewards WHERE user_id = _user_id FOR UPDATE;
  
  -- Check max cap for early bird
  IF _is_early_bird AND _rule.max_points_per_period IS NOT NULL THEN
    IF _current_rewards.early_bird_points >= _rule.max_points_per_period THEN
      RETURN 0;
    END IF;
  END IF;
  
  -- Update rewards
  IF _is_early_bird THEN
    UPDATE public.user_rewards
    SET 
      early_bird_points = early_bird_points + _points,
      total_points = total_points + _points,
      updated_at = now()
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_rewards
    SET 
      activity_points = activity_points + _points,
      total_points = total_points + _points,
      updated_at = now()
    WHERE user_id = _user_id;
  END IF;
  
  -- Log activity
  INSERT INTO public.reward_activities (user_id, activity_type, points_awarded, metadata)
  VALUES (_user_id, _activity_type, _points, _metadata);
  
  RETURN _points;
END;
$$;

-- Function to award badges
CREATE OR REPLACE FUNCTION public.award_badge(
  _user_id UUID,
  _badge_type badge_type,
  _badge_name TEXT,
  _badge_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _badge_id UUID;
BEGIN
  INSERT INTO public.user_badges (user_id, badge_type, badge_name, badge_description)
  VALUES (_user_id, _badge_type, _badge_name, _badge_description)
  ON CONFLICT (user_id, badge_type) DO NOTHING
  RETURNING id INTO _badge_id;
  
  RETURN _badge_id;
END;
$$;

-- Update trigger for updated_at
CREATE TRIGGER update_user_rewards_updated_at
  BEFORE UPDATE ON public.user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_rules_updated_at
  BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();