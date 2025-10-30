-- Remove the incorrect unique constraint that doesn't include chain_id
ALTER TABLE public.wallet_balances DROP CONSTRAINT IF EXISTS wallet_balances_user_token_unique;

-- Verify the correct constraint exists (user_id, token, chain_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'wallet_balances' 
    AND indexname = 'wallet_balances_user_id_token_chain_key'
  ) THEN
    CREATE UNIQUE INDEX wallet_balances_user_id_token_chain_key 
    ON public.wallet_balances (user_id, token, chain_id);
  END IF;
END $$;