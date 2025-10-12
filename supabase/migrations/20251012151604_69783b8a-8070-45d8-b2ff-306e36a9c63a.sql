-- Allow NULL sender_id for external blockchain deposits
-- This enables recording transactions from external wallets (like faucets)
-- that don't have associated user accounts

ALTER TABLE public.transactions 
ALTER COLUMN sender_id DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN public.transactions.sender_id IS 'User ID of sender. NULL for external blockchain deposits from non-users.';