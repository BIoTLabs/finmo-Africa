-- Delete all existing user data
DELETE FROM public.contacts;
DELETE FROM public.transactions;
DELETE FROM public.wallet_balances;
DELETE FROM public.user_registry;
DELETE FROM public.profiles;

-- Delete all users from auth (this will cascade to any remaining related data)
DELETE FROM auth.users;