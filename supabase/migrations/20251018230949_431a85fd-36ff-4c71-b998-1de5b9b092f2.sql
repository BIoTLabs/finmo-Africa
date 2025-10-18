-- Add new testnet chains to supported_chains
INSERT INTO public.supported_chains (chain_id, chain_name, rpc_url, block_explorer, native_currency_symbol, native_currency_decimals, is_active, is_testnet) VALUES
(80001, 'Polygon Mumbai', 'https://rpc-mumbai.maticvigil.com', 'https://mumbai.polygonscan.com', 'MATIC', 18, true, true),
(421614, 'Arbitrum Sepolia', 'https://sepolia-rollup.arbitrum.io/rpc', 'https://sepolia.arbiscan.io', 'ETH', 18, true, true),
(11155420, 'Optimism Sepolia', 'https://sepolia.optimism.io', 'https://sepolia-optimism.etherscan.io', 'ETH', 18, true, true),
(84532, 'Base Sepolia', 'https://sepolia.base.org', 'https://sepolia.basescan.org', 'ETH', 18, true, true),
(534351, 'Scroll Sepolia', 'https://sepolia-rpc.scroll.io', 'https://sepolia.scrollscan.com', 'ETH', 18, true, true)
ON CONFLICT (chain_id) DO UPDATE SET
  chain_name = EXCLUDED.chain_name,
  rpc_url = EXCLUDED.rpc_url,
  block_explorer = EXCLUDED.block_explorer,
  is_active = EXCLUDED.is_active;

-- Add ERC-20 tokens for each chain
-- USDC contracts
INSERT INTO public.chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
(80001, 'USDC', '0x0FA8781a83E46826621b3BC094Ea2A0212e71B23', 6, true),
(421614, 'USDC', '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 6, true),
(11155420, 'USDC', '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', 6, true),
(84532, 'USDC', '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 6, true),
(534351, 'USDC', '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', 6, true),
-- USDT contracts
(80001, 'USDT', '0xA02f6adc7926efeBBd59Fd43A84f4E0c0c91e832', 6, true),
(421614, 'USDT', '0xf7C5c26B574063e7b098ed74fAd6779e65E3F836', 6, true),
(11155420, 'USDT', '0x853eb4bA5D0Ba2B77a0A5329Fd2110d5CE149ECE', 6, true),
(84532, 'USDT', '0xf7C5c26B574063e7b098ed74fAd6779e65E3F836', 6, true),
(534351, 'USDT', '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', 6, true),
-- DAI contracts
(80001, 'DAI', '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F', 18, true),
(421614, 'DAI', '0xE4aB69C077896252FAFBD49EFD26B5D171A32410', 18, true),
(11155420, 'DAI', '0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47', 18, true),
(84532, 'DAI', '0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47', 18, true),
(534351, 'DAI', '0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97', 18, true),
-- WETH contracts
(80001, 'WETH', '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa', 18, true),
(421614, 'WETH', '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', 18, true),
(11155420, 'WETH', '0x4200000000000000000000000000000000000006', 18, true),
(84532, 'WETH', '0x4200000000000000000000000000000000000006', 18, true),
(534351, 'WETH', '0x5300000000000000000000000000000000000004', 18, true),
-- LINK contracts
(80001, 'LINK', '0x326C977E6efc84E512bB9C30f76E30c160eD06FB', 18, true),
(421614, 'LINK', '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E', 18, true),
(11155420, 'LINK', '0xE4aB69C077896252FAFBD49EFD26B5D171A32410', 18, true),
(84532, 'LINK', '0xE4aB69C077896252FAFBD49EFD26B5D171A32410', 18, true),
(534351, 'LINK', '0x6C0496fC55a5DA20fDC18F5d463a515c35E15c7c', 18, true)
ON CONFLICT (chain_id, token_symbol) DO UPDATE SET
  contract_address = EXCLUDED.contract_address,
  decimals = EXCLUDED.decimals,
  is_active = EXCLUDED.is_active;

-- Add chain_id column to wallet_balances if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'wallet_balances' 
                 AND column_name = 'chain_id') THEN
    ALTER TABLE public.wallet_balances ADD COLUMN chain_id INTEGER REFERENCES public.supported_chains(chain_id);
  END IF;
END $$;

-- Drop old unique constraint and create new one with chain_id
ALTER TABLE public.wallet_balances DROP CONSTRAINT IF EXISTS wallet_balances_user_id_token_key;
ALTER TABLE public.wallet_balances ADD CONSTRAINT wallet_balances_user_id_token_chain_key UNIQUE (user_id, token, chain_id);

-- Create table for active sessions (single session per user)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_sessions
CREATE POLICY "Users can view own session" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own session" ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Function to enforce single session per user
CREATE OR REPLACE FUNCTION public.enforce_single_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_session_id TEXT;
BEGIN
  -- Check if user already has an active session
  SELECT session_id INTO existing_session_id
  FROM public.user_sessions
  WHERE user_id = NEW.user_id;

  IF existing_session_id IS NOT NULL AND existing_session_id != NEW.session_id THEN
    -- Delete the old session
    DELETE FROM public.user_sessions WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to enforce single session on insert
DROP TRIGGER IF EXISTS enforce_single_session_trigger ON public.user_sessions;
CREATE TRIGGER enforce_single_session_trigger
  BEFORE INSERT ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_session();