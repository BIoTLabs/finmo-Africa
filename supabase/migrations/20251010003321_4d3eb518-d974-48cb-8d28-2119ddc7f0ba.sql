-- Create KYC verifications table
CREATE TABLE public.kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  country_code TEXT NOT NULL,
  id_type TEXT NOT NULL CHECK (id_type IN ('passport', 'drivers_license', 'national_id', 'voters_card')),
  id_number TEXT NOT NULL,
  id_document_url TEXT,
  selfie_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for KYC
CREATE POLICY "Users can view own KYC" ON public.kyc_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC" ON public.kyc_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending KYC" ON public.kyc_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all KYC" ON public.kyc_verifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update KYC status" ON public.kyc_verifications
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add escrow fields to marketplace_orders
ALTER TABLE public.marketplace_orders
  ADD COLUMN escrow_amount NUMERIC DEFAULT 0,
  ADD COLUMN escrow_released BOOLEAN DEFAULT false,
  ADD COLUMN rider_amount NUMERIC DEFAULT 0,
  ADD COLUMN seller_amount NUMERIC DEFAULT 0,
  ADD COLUMN buyer_confirmed_delivery BOOLEAN DEFAULT false,
  ADD COLUMN buyer_confirmation_date TIMESTAMPTZ;

-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for KYC documents
CREATE POLICY "Users can upload own KYC documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own KYC documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all KYC documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Create storage bucket for marketplace images
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-images', 'marketplace-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketplace images
CREATE POLICY "Anyone can view marketplace images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace-images');

CREATE POLICY "Authenticated users can upload marketplace images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'marketplace-images' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own marketplace images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'marketplace-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );