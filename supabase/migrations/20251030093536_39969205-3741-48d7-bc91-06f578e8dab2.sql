-- First, fix existing negative balances by recalculating from transactions
-- This will set balances to the sum of all transactions for each user/token
UPDATE wallet_balances wb
SET balance = COALESCE((
  SELECT 
    SUM(CASE 
      WHEN t.recipient_id = wb.user_id THEN t.amount
      WHEN t.sender_id = wb.user_id THEN -(t.amount + COALESCE(t.withdrawal_fee, 0))
      ELSE 0
    END)
  FROM transactions t
  WHERE (t.sender_id = wb.user_id OR t.recipient_id = wb.user_id)
    AND t.token = wb.token
    AND t.status = 'completed'
), 0)
WHERE balance < 0;

-- Now add check constraint to prevent negative balances in the future
ALTER TABLE wallet_balances 
ADD CONSTRAINT wallet_balances_non_negative 
CHECK (balance >= 0);

-- Create index on transactions for faster balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_balance_calc 
ON transactions(sender_id, recipient_id, token, status) 
WHERE status = 'completed';