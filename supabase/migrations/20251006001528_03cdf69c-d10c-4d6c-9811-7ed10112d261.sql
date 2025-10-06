-- Delete all user-related data to allow fresh start
-- This removes all data from public schema tables while preserving table structure

-- Delete transactions and related data
TRUNCATE TABLE public.card_transactions CASCADE;
TRUNCATE TABLE public.transactions CASCADE;

-- Delete P2P related data
TRUNCATE TABLE public.p2p_disputes CASCADE;
TRUNCATE TABLE public.p2p_orders CASCADE;
TRUNCATE TABLE public.p2p_listings CASCADE;

-- Delete payment and card data
TRUNCATE TABLE public.virtual_cards CASCADE;
TRUNCATE TABLE public.payment_methods CASCADE;

-- Delete contact data
TRUNCATE TABLE public.contact_invitations CASCADE;
TRUNCATE TABLE public.contacts CASCADE;

-- Delete wallet balances
TRUNCATE TABLE public.wallet_balances CASCADE;

-- Delete user roles (including admin roles)
TRUNCATE TABLE public.user_roles CASCADE;

-- Delete user registry and profiles
TRUNCATE TABLE public.user_registry CASCADE;
TRUNCATE TABLE public.profiles CASCADE;