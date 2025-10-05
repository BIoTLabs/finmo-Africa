-- Enable realtime for transactions
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Enable realtime for wallet_balances  
ALTER TABLE public.wallet_balances REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_balances;