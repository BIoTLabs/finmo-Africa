-- Create disputes table for P2P and Marketplace order disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('p2p_order', 'marketplace_order')),
  order_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'rejected')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Users can create their own disputes
CREATE POLICY "Users can create own disputes"
ON public.disputes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own disputes
CREATE POLICY "Users can view own disputes"
ON public.disputes
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all disputes
CREATE POLICY "Admins can view all disputes"
ON public.disputes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update disputes
CREATE POLICY "Admins can update disputes"
ON public.disputes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user ratings table
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('p2p', 'marketplace')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rated_by_user_id, order_id)
);

-- Enable RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Users can create ratings
CREATE POLICY "Users can create ratings"
ON public.user_ratings
FOR INSERT
WITH CHECK (auth.uid() = rated_by_user_id);

-- Users can view ratings of others
CREATE POLICY "Anyone can view ratings"
ON public.user_ratings
FOR SELECT
USING (true);

-- Create order messages table for in-app messaging
CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('p2p', 'marketplace')),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Users can send messages for their orders
CREATE POLICY "Users can send messages for their orders"
ON public.order_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (
      SELECT 1 FROM public.p2p_orders 
      WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.marketplace_orders 
      WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  )
);

-- Users can view messages for their orders
CREATE POLICY "Users can view messages for their orders"
ON public.order_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.p2p_orders 
    WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM public.marketplace_orders 
    WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  )
);

-- Users can update read status of messages
CREATE POLICY "Users can mark messages as read"
ON public.order_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.p2p_orders 
    WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM public.marketplace_orders 
    WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  )
);

-- Enable realtime for order messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- Create indexes for better performance
CREATE INDEX idx_disputes_user_id ON public.disputes(user_id);
CREATE INDEX idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);

CREATE INDEX idx_user_ratings_rated_user_id ON public.user_ratings(rated_user_id);
CREATE INDEX idx_user_ratings_order_id ON public.user_ratings(order_id);

CREATE INDEX idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX idx_order_messages_created_at ON public.order_messages(created_at DESC);