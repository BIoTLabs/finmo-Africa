-- Add Account Abstraction wallet fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS aa_wallet_address TEXT,
ADD COLUMN IF NOT EXISTS aa_wallet_deployed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aa_wallet_salt TEXT;

-- Create index for fast AA wallet lookups
CREATE INDEX IF NOT EXISTS idx_profiles_aa_wallet ON profiles(aa_wallet_address);

-- Add comment for documentation
COMMENT ON COLUMN profiles.aa_wallet_address IS 'ERC-4337 Smart Contract Wallet address (counterfactual)';
COMMENT ON COLUMN profiles.aa_wallet_deployed IS 'Whether the AA wallet has been deployed on-chain';
COMMENT ON COLUMN profiles.aa_wallet_salt IS 'Salt used for counterfactual address generation';