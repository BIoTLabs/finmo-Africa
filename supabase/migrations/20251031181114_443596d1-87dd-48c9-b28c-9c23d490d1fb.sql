-- Make wallet_address nullable in profiles table to allow user creation before wallet generation
ALTER TABLE public.profiles 
ALTER COLUMN wallet_address DROP NOT NULL;

-- Make wallet_address nullable in user_registry table
ALTER TABLE public.user_registry 
ALTER COLUMN wallet_address DROP NOT NULL;