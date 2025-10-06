-- Add explicit denial policies for anonymous users on sensitive tables
-- This ensures no public/anonymous access is possible even if RLS is misconfigured

-- Profiles table: Block all anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- User registry table: Block all anonymous access
CREATE POLICY "Block anonymous access to user_registry"
ON public.user_registry
FOR ALL
TO anon
USING (false);

-- Transactions table: Block all anonymous access
CREATE POLICY "Block anonymous access to transactions"
ON public.transactions
FOR ALL
TO anon
USING (false);

-- Wallet balances table: Block all anonymous access (extra security)
CREATE POLICY "Block anonymous access to wallet_balances"
ON public.wallet_balances
FOR ALL
TO anon
USING (false);

-- P2P tables: Block anonymous access
CREATE POLICY "Block anonymous access to p2p_orders"
ON public.p2p_orders
FOR ALL
TO anon
USING (false);

CREATE POLICY "Block anonymous access to p2p_listings"
ON public.p2p_listings
FOR ALL
TO anon
USING (false);

-- Payment methods: Block anonymous access
CREATE POLICY "Block anonymous access to payment_methods"
ON public.payment_methods
FOR ALL
TO anon
USING (false);

-- Virtual cards: Block anonymous access
CREATE POLICY "Block anonymous access to virtual_cards"
ON public.virtual_cards
FOR ALL
TO anon
USING (false);

-- Card transactions: Block anonymous access
CREATE POLICY "Block anonymous access to card_transactions"
ON public.card_transactions
FOR ALL
TO anon
USING (false);