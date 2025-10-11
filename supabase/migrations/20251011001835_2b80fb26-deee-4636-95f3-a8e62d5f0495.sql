-- Add marketplace_bids table for negotiation system
CREATE TABLE IF NOT EXISTS public.marketplace_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  message TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_bids
CREATE POLICY "Users can create bids"
  ON public.marketplace_bids
  FOR INSERT
  WITH CHECK (auth.uid() = bidder_id);

CREATE POLICY "Bidders and sellers can view their bids"
  ON public.marketplace_bids
  FOR SELECT
  USING (auth.uid() = bidder_id OR auth.uid() = seller_id);

CREATE POLICY "Sellers can update bid status"
  ON public.marketplace_bids
  FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Bidders can update their pending bids"
  ON public.marketplace_bids
  FOR UPDATE
  USING (auth.uid() = bidder_id AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_marketplace_bids_updated_at
  BEFORE UPDATE ON public.marketplace_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_marketplace_bids_listing ON public.marketplace_bids(listing_id);
CREATE INDEX idx_marketplace_bids_bidder ON public.marketplace_bids(bidder_id);
CREATE INDEX idx_marketplace_bids_seller ON public.marketplace_bids(seller_id);
CREATE INDEX idx_marketplace_bids_status ON public.marketplace_bids(status);