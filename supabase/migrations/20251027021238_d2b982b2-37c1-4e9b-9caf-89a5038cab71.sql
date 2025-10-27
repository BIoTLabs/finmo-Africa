-- Add 'deposit' and 'withdrawal' as valid transaction types
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type IN ('internal', 'external', 'deposit', 'withdrawal'));

-- Update existing sweep transactions to be deposit type
UPDATE transactions
SET transaction_type = 'deposit'
WHERE recipient_wallet = '0xc56200868ed6b741a9958f4aa8cec3ceda2d22d6'
  AND sender_id IS NOT NULL
  AND transaction_type = 'external';