-- Create gas_fundings table to track automatic gas funding operations
CREATE TABLE IF NOT EXISTS gas_fundings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_wallet_address TEXT NOT NULL,
  master_wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  chain_name TEXT NOT NULL,
  tx_hash TEXT,
  reason TEXT DEFAULT 'deposit_detected',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by wallet
CREATE INDEX idx_gas_fundings_wallet ON gas_fundings(user_wallet_address);

-- Index for monitoring costs and recent fundings
CREATE INDEX idx_gas_fundings_created ON gas_fundings(created_at DESC);

-- RLS policies
ALTER TABLE gas_fundings ENABLE ROW LEVEL SECURITY;

-- Users can view their own gas fundings
CREATE POLICY "Users can view own gas fundings"
  ON gas_fundings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all gas fundings
CREATE POLICY "Admins can view all gas fundings"
  ON gas_fundings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));