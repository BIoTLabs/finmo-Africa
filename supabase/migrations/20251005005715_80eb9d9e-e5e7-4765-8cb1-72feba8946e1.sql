-- Create transactions table for tracking transfers
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_wallet TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  token TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('internal', 'external')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions (sent or received)
CREATE POLICY "Users can view own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can insert their own transactions
CREATE POLICY "Users can create own transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Create wallet_balances table
CREATE TABLE public.wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own balances
CREATE POLICY "Users can view own balances"
  ON public.wallet_balances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own balances
CREATE POLICY "Users can update own balances"
  ON public.wallet_balances
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own balances
CREATE POLICY "Users can insert own balances"
  ON public.wallet_balances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for wallet_balances timestamps
CREATE TRIGGER update_wallet_balances_updated_at
  BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_phone)
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own contacts
CREATE POLICY "Users can view own contacts"
  ON public.contacts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON public.contacts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON public.contacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to initialize default wallet balances
CREATE OR REPLACE FUNCTION public.initialize_wallet_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Add default USDC balance
  INSERT INTO public.wallet_balances (user_id, token, balance)
  VALUES (NEW.id, 'USDC', 1250.50);
  
  -- Add default MATIC balance
  INSERT INTO public.wallet_balances (user_id, token, balance)
  VALUES (NEW.id, 'MATIC', 45.32);
  
  RETURN NEW;
END;
$$;

-- Trigger to initialize balances on profile creation
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_wallet_balances();