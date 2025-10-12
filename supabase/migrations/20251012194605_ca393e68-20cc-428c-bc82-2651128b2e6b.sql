-- Create table for user 2FA preferences
CREATE TABLE IF NOT EXISTS public.user_2fa_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 2FA enforcement settings for different actions
  require_on_login BOOLEAN DEFAULT true,
  require_on_send BOOLEAN DEFAULT false,
  require_on_withdraw BOOLEAN DEFAULT true,
  require_on_p2p_trade BOOLEAN DEFAULT false,
  require_on_marketplace_purchase BOOLEAN DEFAULT false,
  require_on_security_changes BOOLEAN DEFAULT true,
  require_on_payment_method_changes BOOLEAN DEFAULT false,
  require_on_staking BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_2fa_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own 2FA preferences"
ON public.user_2fa_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own 2FA preferences"
ON public.user_2fa_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own 2FA preferences"
ON public.user_2fa_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_2fa_preferences_updated_at
BEFORE UPDATE ON public.user_2fa_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize default 2FA preferences when user enables 2FA
CREATE OR REPLACE FUNCTION public.initialize_2fa_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default preferences if they don't exist
  INSERT INTO public.user_2fa_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to initialize 2FA preferences on user creation
CREATE TRIGGER on_user_created_init_2fa_prefs
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_2fa_preferences();