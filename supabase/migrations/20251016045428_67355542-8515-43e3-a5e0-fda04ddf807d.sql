-- Enable public viewing of all transactions for authenticated users (explorer feature)
-- This allows transparency while protecting user privacy (only wallet addresses shown)

-- Transactions table: Allow all authenticated users to view all transactions
CREATE POLICY "explorer_view_all_transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (true);

-- P2P Orders: Allow all authenticated users to view all P2P orders
CREATE POLICY "explorer_view_p2p_orders"
ON public.p2p_orders FOR SELECT
TO authenticated
USING (true);

-- Marketplace Orders: Allow all authenticated users to view all marketplace orders
CREATE POLICY "explorer_view_marketplace_orders"
ON public.marketplace_orders FOR SELECT
TO authenticated
USING (true);

-- Staking Positions: Allow all authenticated users to view all staking positions
CREATE POLICY "explorer_view_staking_positions"
ON public.staking_positions FOR SELECT
TO authenticated
USING (true);