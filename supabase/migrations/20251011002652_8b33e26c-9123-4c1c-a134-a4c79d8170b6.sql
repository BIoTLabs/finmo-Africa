-- Add chain support to blockchain transactions
-- This will allow tracking deposits and withdrawals across multiple L2 chains

-- Add chain_id and chain_name columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS chain_id integer,
ADD COLUMN IF NOT EXISTS chain_name text;

-- Create index for chain lookups
CREATE INDEX IF NOT EXISTS idx_transactions_chain_id ON public.transactions(chain_id);

-- Create a table to store supported chains
CREATE TABLE IF NOT EXISTS public.supported_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer UNIQUE NOT NULL,
  chain_name text NOT NULL,
  rpc_url text NOT NULL,
  block_explorer text NOT NULL,
  native_currency_symbol text NOT NULL,
  native_currency_decimals integer NOT NULL DEFAULT 18,
  is_active boolean DEFAULT true,
  is_testnet boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on supported_chains
ALTER TABLE public.supported_chains ENABLE ROW LEVEL SECURITY;

-- Anyone can view active chains
CREATE POLICY "Anyone can view active chains"
ON public.supported_chains
FOR SELECT
USING (is_active = true);

-- Insert L2 chains (Polygon Amoy Testnet and Sepolia Testnet for now)
INSERT INTO public.supported_chains (chain_id, chain_name, rpc_url, block_explorer, native_currency_symbol, native_currency_decimals, is_testnet)
VALUES 
  (80002, 'Polygon Amoy Testnet', 'https://rpc-amoy.polygon.technology', 'https://amoy.polygonscan.com', 'MATIC', 18, true),
  (11155111, 'Ethereum Sepolia', 'https://rpc.sepolia.org', 'https://sepolia.etherscan.io', 'ETH', 18, true)
ON CONFLICT (chain_id) DO UPDATE
SET 
  rpc_url = EXCLUDED.rpc_url,
  block_explorer = EXCLUDED.block_explorer,
  is_active = EXCLUDED.is_active;

-- Create a table to store token contracts on different chains
CREATE TABLE IF NOT EXISTS public.chain_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL REFERENCES public.supported_chains(chain_id),
  token_symbol text NOT NULL,
  contract_address text NOT NULL,
  decimals integer NOT NULL DEFAULT 18,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(chain_id, token_symbol)
);

-- Enable RLS on chain_tokens
ALTER TABLE public.chain_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can view active chain tokens
CREATE POLICY "Anyone can view active chain tokens"
ON public.chain_tokens
FOR SELECT
USING (is_active = true);

-- Insert USDC contracts for supported chains
INSERT INTO public.chain_tokens (chain_id, token_symbol, contract_address, decimals)
VALUES 
  (80002, 'USDC', '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', 6),
  (11155111, 'USDC', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 6)
ON CONFLICT (chain_id, token_symbol) DO UPDATE
SET contract_address = EXCLUDED.contract_address;