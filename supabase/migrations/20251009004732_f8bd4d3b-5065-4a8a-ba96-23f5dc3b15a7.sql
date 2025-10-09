-- Create marketplace categories table
CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create marketplace listings table
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.marketplace_categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USDC',
  images TEXT[],
  condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  is_service BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create marketplace orders table
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  gifted_to_user_id UUID REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled', 'disputed')),
  delivery_address TEXT,
  delivery_phone TEXT,
  delivery_name TEXT,
  payment_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create delivery bids table
CREATE TABLE public.marketplace_delivery_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES auth.users(id),
  bid_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USDC',
  estimated_delivery_time INTEGER, -- in minutes
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create marketplace notifications table
CREATE TABLE public.marketplace_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order_created', 'order_paid', 'delivery_needed', 'bid_received', 'bid_accepted', 'order_delivered', 'gift_received')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_delivery_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Anyone can view active categories"
  ON public.marketplace_categories FOR SELECT
  USING (is_active = true);

-- RLS Policies for listings
CREATE POLICY "Anyone can view active listings"
  ON public.marketplace_listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create own listings"
  ON public.marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own listings"
  ON public.marketplace_listings FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete own listings"
  ON public.marketplace_listings FOR DELETE
  USING (auth.uid() = seller_id);

-- RLS Policies for orders
CREATE POLICY "Users can view own orders"
  ON public.marketplace_orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = gifted_to_user_id);

CREATE POLICY "Users can create orders"
  ON public.marketplace_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers and sellers can update orders"
  ON public.marketplace_orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for delivery bids
CREATE POLICY "Users can view bids for their orders"
  ON public.marketplace_delivery_bids FOR SELECT
  USING (
    auth.uid() IN (
      SELECT buyer_id FROM public.marketplace_orders WHERE id = order_id
      UNION
      SELECT seller_id FROM public.marketplace_orders WHERE id = order_id
    ) OR auth.uid() = rider_id
  );

CREATE POLICY "Riders can create bids"
  ON public.marketplace_delivery_bids FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Order owners can update bid status"
  ON public.marketplace_delivery_bids FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT buyer_id FROM public.marketplace_orders WHERE id = order_id
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON public.marketplace_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.marketplace_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert default categories
INSERT INTO public.marketplace_categories (name, description, icon) VALUES
  ('Electronics', 'Phones, laptops, and gadgets', 'Smartphone'),
  ('Fashion', 'Clothing, shoes, and accessories', 'Shirt'),
  ('Home & Garden', 'Furniture, appliances, and decor', 'Home'),
  ('Vehicles', 'Cars, motorcycles, and parts', 'Car'),
  ('Services', 'Professional services and skills', 'Briefcase'),
  ('Real Estate', 'Property for sale or rent', 'Building'),
  ('Sports & Fitness', 'Equipment and accessories', 'Dumbbell'),
  ('Books & Media', 'Books, movies, and music', 'BookOpen'),
  ('Food & Groceries', 'Fresh food and groceries', 'ShoppingBasket'),
  ('Other', 'Miscellaneous items', 'Package');

-- Create updated_at trigger
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();