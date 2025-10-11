-- Create staking_positions table
CREATE TABLE public.staking_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  staked_amount NUMERIC NOT NULL CHECK (staked_amount > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  apy_rate NUMERIC NOT NULL DEFAULT 5.0,
  rewards_earned NUMERIC NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staking_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own staking positions"
ON public.staking_positions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own staking positions"
ON public.staking_positions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own staking positions"
ON public.staking_positions
FOR UPDATE
USING (auth.uid() = user_id);

-- Block anonymous access
CREATE POLICY "Block anonymous access to staking_positions"
ON public.staking_positions
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Create function to calculate rewards
CREATE OR REPLACE FUNCTION public.calculate_staking_rewards(
  _amount NUMERIC,
  _apy_rate NUMERIC,
  _duration_days INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate rewards: (amount * apy_rate / 100) * (days / 365)
  RETURN (_amount * _apy_rate / 100) * (_duration_days::NUMERIC / 365);
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_staking_positions_updated_at
BEFORE UPDATE ON public.staking_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_staking_positions_user_id ON public.staking_positions(user_id);
CREATE INDEX idx_staking_positions_status ON public.staking_positions(status);