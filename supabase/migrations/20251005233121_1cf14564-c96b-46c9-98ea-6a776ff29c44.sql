-- Create enum for P2P order status
CREATE TYPE p2p_order_status AS ENUM ('pending', 'paid', 'completed', 'cancelled', 'disputed');

-- Create enum for P2P listing type
CREATE TYPE p2p_listing_type AS ENUM ('buy', 'sell');

-- Create table for supported countries and currencies
CREATE TABLE public.supported_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert African countries
INSERT INTO public.supported_countries (country_code, country_name, currency_code, currency_symbol) VALUES
  ('NG', 'Nigeria', 'NGN', '₦'),
  ('KE', 'Kenya', 'KES', 'KSh'),
  ('ZA', 'South Africa', 'ZAR', 'R'),
  ('GH', 'Ghana', 'GHS', '₵'),
  ('UG', 'Uganda', 'UGX', 'USh'),
  ('TZ', 'Tanzania', 'TZS', 'TSh'),
  ('RW', 'Rwanda', 'RWF', 'RF'),
  ('EG', 'Egypt', 'EGP', 'E£');

-- Create table for payment methods
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  method_type TEXT NOT NULL, -- 'bank_transfer', 'mobile_money', etc.
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  additional_info JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for P2P listings
CREATE TABLE public.p2p_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_type p2p_listing_type NOT NULL,
  token TEXT NOT NULL, -- 'USDC', 'USDT'
  country_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  rate NUMERIC NOT NULL, -- Exchange rate
  min_amount NUMERIC NOT NULL,
  max_amount NUMERIC NOT NULL,
  available_amount NUMERIC NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_time_limit INTEGER DEFAULT 15, -- minutes
  terms TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for P2P orders
CREATE TABLE public.p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.p2p_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL,
  crypto_amount NUMERIC NOT NULL,
  fiat_amount NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  currency_code TEXT NOT NULL,
  status p2p_order_status DEFAULT 'pending',
  payment_method_id UUID REFERENCES public.payment_methods(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for P2P disputes
CREATE TABLE public.p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.p2p_orders(id),
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'open', -- 'open', 'resolved', 'closed'
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for virtual cards
CREATE TABLE public.virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number_encrypted TEXT NOT NULL,
  card_holder_name TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  cvv_encrypted TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  spending_limit NUMERIC DEFAULT 1000,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  is_frozen BOOLEAN DEFAULT false,
  external_card_id TEXT, -- ID from card provider
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for card transactions
CREATE TABLE public.card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.virtual_cards(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  merchant_name TEXT,
  merchant_category TEXT,
  status TEXT DEFAULT 'completed',
  transaction_type TEXT NOT NULL, -- 'purchase', 'refund', 'load'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supported_countries
CREATE POLICY "Anyone can view supported countries"
ON public.supported_countries FOR SELECT
USING (true);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view own payment methods"
ON public.payment_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
ON public.payment_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
ON public.payment_methods FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
ON public.payment_methods FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for p2p_listings
CREATE POLICY "Anyone can view active listings"
ON public.p2p_listings FOR SELECT
USING (is_active = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own listings"
ON public.p2p_listings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings"
ON public.p2p_listings FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for p2p_orders
CREATE POLICY "Users can view own orders"
ON public.p2p_orders FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create orders"
ON public.p2p_orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update own orders"
ON public.p2p_orders FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for p2p_disputes
CREATE POLICY "Users can view disputes they're involved in"
ON public.p2p_disputes FOR SELECT
USING (
  auth.uid() = raised_by OR 
  auth.uid() IN (
    SELECT buyer_id FROM public.p2p_orders WHERE id = order_id
    UNION
    SELECT seller_id FROM public.p2p_orders WHERE id = order_id
  )
);

CREATE POLICY "Users can create disputes for their orders"
ON public.p2p_disputes FOR INSERT
WITH CHECK (auth.uid() = raised_by);

-- RLS Policies for virtual_cards
CREATE POLICY "Users can view own cards"
ON public.virtual_cards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cards"
ON public.virtual_cards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
ON public.virtual_cards FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for card_transactions
CREATE POLICY "Users can view own card transactions"
ON public.card_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert card transactions"
ON public.card_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_p2p_listings_updated_at
BEFORE UPDATE ON public.p2p_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_p2p_orders_updated_at
BEFORE UPDATE ON public.p2p_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_virtual_cards_updated_at
BEFORE UPDATE ON public.virtual_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();