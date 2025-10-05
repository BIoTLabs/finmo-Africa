-- Add unique constraint to wallet_balances to support upsert operations
-- This ensures each user can only have one balance record per token
ALTER TABLE public.wallet_balances 
ADD CONSTRAINT wallet_balances_user_token_unique 
UNIQUE (user_id, token);

-- Update withdrawal fees admin setting with default values
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES ('withdrawal_fees', '{"USDC": 0.5, "MATIC": 0.001}'::jsonb)
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = EXCLUDED.setting_value;