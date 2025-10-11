-- Add listing_type column to marketplace_listings
ALTER TABLE marketplace_listings 
ADD COLUMN listing_type text NOT NULL DEFAULT 'fixed_price' CHECK (listing_type IN ('fixed_price', 'bidding'));

-- Add escrow_amount to marketplace_bids
ALTER TABLE marketplace_bids 
ADD COLUMN escrow_amount numeric DEFAULT 0;

-- Update marketplace_bids RLS to prevent self-bidding
DROP POLICY IF EXISTS "Users can create bids" ON marketplace_bids;

CREATE POLICY "Users can create bids on others' listings"
ON marketplace_bids
FOR INSERT
WITH CHECK (
  auth.uid() = bidder_id 
  AND auth.uid() != seller_id
);

-- Policy for bid cancellation
CREATE POLICY "Bidders can delete their pending bids"
ON marketplace_bids
FOR DELETE
USING (
  auth.uid() = bidder_id 
  AND status = 'pending'
);