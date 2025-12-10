
-- Phase 1: Enhanced KYC & Compliance System

-- 1.1 Create KYC Tier enum type
DO $$ BEGIN
  CREATE TYPE kyc_tier AS ENUM ('tier_0', 'tier_1', 'tier_2', 'tier_3');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.2 Create KYC Tiers configuration table
CREATE TABLE IF NOT EXISTS public.kyc_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier kyc_tier NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  daily_limit_usd numeric NOT NULL DEFAULT 50,
  monthly_limit_usd numeric NOT NULL DEFAULT 200,
  single_transaction_limit_usd numeric,
  required_documents text[] NOT NULL DEFAULT '{}',
  required_fields text[] NOT NULL DEFAULT '{}',
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.3 Create Country-Specific KYC Requirements table
CREATE TABLE IF NOT EXISTS public.country_kyc_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_iso text NOT NULL,
  tier kyc_tier NOT NULL,
  required_documents text[] NOT NULL DEFAULT '{}',
  required_fields text[] NOT NULL DEFAULT '{}',
  accepted_id_types text[] NOT NULL DEFAULT '{}',
  additional_validations jsonb DEFAULT '{}',
  daily_limit_override numeric,
  monthly_limit_override numeric,
  single_transaction_limit_override numeric,
  regulatory_notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country_iso, tier)
);

-- 1.4 Create User Transaction Limits tracking table
CREATE TABLE IF NOT EXISTS public.user_transaction_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  daily_total_usd numeric DEFAULT 0,
  monthly_total_usd numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  last_transaction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 1.5 Add new columns to kyc_verifications table
ALTER TABLE public.kyc_verifications 
ADD COLUMN IF NOT EXISTS kyc_tier kyc_tier DEFAULT 'tier_0',
ADD COLUMN IF NOT EXISTS verification_level kyc_tier DEFAULT 'tier_1',
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS tax_id_type text,
ADD COLUMN IF NOT EXISTS proof_of_address_url text,
ADD COLUMN IF NOT EXISTS proof_of_address_type text,
ADD COLUMN IF NOT EXISTS source_of_funds text,
ADD COLUMN IF NOT EXISTS source_of_funds_documents text[],
ADD COLUMN IF NOT EXISTS employer_name text,
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS liveness_check_passed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS liveness_score numeric,
ADD COLUMN IF NOT EXISTS id_verification_score numeric,
ADD COLUMN IF NOT EXISTS face_match_score numeric,
ADD COLUMN IF NOT EXISTS address_verification_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS risk_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_flags jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS reviewer_checklist jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS escalated_to uuid,
ADD COLUMN IF NOT EXISTS escalation_reason text;

-- 1.6 Add kyc_tier to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_tier kyc_tier DEFAULT 'tier_0',
ADD COLUMN IF NOT EXISTS kyc_tier_upgraded_at timestamptz,
ADD COLUMN IF NOT EXISTS transaction_limits_reset_at timestamptz;

-- 1.7 Enable RLS on new tables
ALTER TABLE public.kyc_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_kyc_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_transaction_limits ENABLE ROW LEVEL SECURITY;

-- 1.8 RLS Policies for kyc_tiers (public read, admin manage)
CREATE POLICY "Anyone can view active KYC tiers"
ON public.kyc_tiers FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage KYC tiers"
ON public.kyc_tiers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.9 RLS Policies for country_kyc_requirements
CREATE POLICY "Anyone can view active country KYC requirements"
ON public.country_kyc_requirements FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage country KYC requirements"
ON public.country_kyc_requirements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.10 RLS Policies for user_transaction_limits
CREATE POLICY "Users can view own transaction limits"
ON public.user_transaction_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transaction limits"
ON public.user_transaction_limits FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Admins can view all transaction limits"
ON public.user_transaction_limits FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.11 Insert default KYC tier configurations
INSERT INTO public.kyc_tiers (tier, name, description, daily_limit_usd, monthly_limit_usd, single_transaction_limit_usd, required_documents, required_fields, features) VALUES
('tier_0', 'Basic', 'Phone verified only - minimal limits', 50, 200, 25, '{}', '{"phone_number"}', '{"can_receive": true, "can_send": true, "can_p2p": false, "can_withdraw": false}'),
('tier_1', 'Verified', 'ID verified - standard limits', 500, 2000, 250, '{"government_id", "selfie"}', '{"phone_number", "full_name", "date_of_birth", "id_number"}', '{"can_receive": true, "can_send": true, "can_p2p": true, "can_withdraw": true}'),
('tier_2', 'Enhanced', 'Address & tax ID verified - higher limits', 5000, 20000, 2500, '{"government_id", "selfie", "proof_of_address", "tax_id"}', '{"phone_number", "full_name", "date_of_birth", "id_number", "address", "tax_id"}', '{"can_receive": true, "can_send": true, "can_p2p": true, "can_withdraw": true, "can_stake": true}'),
('tier_3', 'Premium', 'Full KYC with source of funds - maximum limits', 50000, 200000, 25000, '{"government_id", "selfie", "proof_of_address", "tax_id", "source_of_funds"}', '{"phone_number", "full_name", "date_of_birth", "id_number", "address", "tax_id", "source_of_funds", "occupation"}', '{"can_receive": true, "can_send": true, "can_p2p": true, "can_withdraw": true, "can_stake": true, "priority_support": true}')
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  daily_limit_usd = EXCLUDED.daily_limit_usd,
  monthly_limit_usd = EXCLUDED.monthly_limit_usd,
  single_transaction_limit_usd = EXCLUDED.single_transaction_limit_usd,
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  features = EXCLUDED.features,
  updated_at = now();

-- 1.12 Insert country-specific KYC requirements
-- Nigeria
INSERT INTO public.country_kyc_requirements (country_iso, tier, required_documents, required_fields, accepted_id_types, additional_validations, regulatory_notes) VALUES
('NG', 'tier_1', '{"government_id", "selfie"}', '{"full_name", "date_of_birth", "id_number"}', '{"NIN Slip", "Voter''s Card", "Driver''s License", "International Passport"}', '{"nin_verification": true}', 'CBN guidelines require NIN for financial services'),
('NG', 'tier_2', '{"government_id", "selfie", "proof_of_address"}', '{"full_name", "date_of_birth", "id_number", "address", "bvn"}', '{"NIN Slip", "Voter''s Card", "Driver''s License", "International Passport"}', '{"nin_verification": true, "bvn_verification": true}', 'BVN required for enhanced verification per CBN'),
('NG', 'tier_3', '{"government_id", "selfie", "proof_of_address", "bank_statement", "source_of_funds"}', '{"full_name", "date_of_birth", "id_number", "address", "bvn", "source_of_funds", "occupation"}', '{"NIN Slip", "International Passport"}', '{"nin_verification": true, "bvn_verification": true, "source_of_funds_declaration": true}', 'Full CDD per CBN AML/CFT requirements')
ON CONFLICT (country_iso, tier) DO UPDATE SET
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  accepted_id_types = EXCLUDED.accepted_id_types,
  additional_validations = EXCLUDED.additional_validations,
  regulatory_notes = EXCLUDED.regulatory_notes,
  updated_at = now();

-- South Africa
INSERT INTO public.country_kyc_requirements (country_iso, tier, required_documents, required_fields, accepted_id_types, additional_validations, regulatory_notes) VALUES
('ZA', 'tier_1', '{"government_id", "selfie"}', '{"full_name", "date_of_birth", "id_number"}', '{"SA ID Card", "SA ID Book", "Passport"}', '{"sa_id_verification": true}', 'FICA compliance required'),
('ZA', 'tier_2', '{"government_id", "selfie", "proof_of_address"}', '{"full_name", "date_of_birth", "id_number", "address", "tax_number"}', '{"SA ID Card", "Passport"}', '{"sa_id_verification": true, "fica_questionnaire": true}', 'FICA enhanced due diligence'),
('ZA', 'tier_3', '{"government_id", "selfie", "proof_of_address", "source_of_funds", "bank_statement"}', '{"full_name", "date_of_birth", "id_number", "address", "tax_number", "source_of_funds", "occupation"}', '{"SA ID Card", "Passport"}', '{"sa_id_verification": true, "fica_questionnaire": true, "source_of_wealth": true}', 'Full FICA compliance with source of wealth')
ON CONFLICT (country_iso, tier) DO UPDATE SET
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  accepted_id_types = EXCLUDED.accepted_id_types,
  additional_validations = EXCLUDED.additional_validations,
  regulatory_notes = EXCLUDED.regulatory_notes,
  updated_at = now();

-- Kenya
INSERT INTO public.country_kyc_requirements (country_iso, tier, required_documents, required_fields, accepted_id_types, additional_validations, regulatory_notes) VALUES
('KE', 'tier_1', '{"government_id", "selfie"}', '{"full_name", "date_of_birth", "id_number"}', '{"National ID", "Passport"}', '{"iprs_verification": true}', 'CBK guidelines for digital financial services'),
('KE', 'tier_2', '{"government_id", "selfie", "proof_of_address"}', '{"full_name", "date_of_birth", "id_number", "address", "kra_pin"}', '{"National ID", "Passport"}', '{"iprs_verification": true, "kra_verification": true}', 'KRA PIN required for enhanced tier'),
('KE', 'tier_3', '{"government_id", "selfie", "proof_of_address", "source_of_funds"}', '{"full_name", "date_of_birth", "id_number", "address", "kra_pin", "source_of_funds", "occupation"}', '{"National ID", "Passport"}', '{"iprs_verification": true, "kra_verification": true, "video_verification": true}', 'Full KYC with video verification')
ON CONFLICT (country_iso, tier) DO UPDATE SET
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  accepted_id_types = EXCLUDED.accepted_id_types,
  additional_validations = EXCLUDED.additional_validations,
  regulatory_notes = EXCLUDED.regulatory_notes,
  updated_at = now();

-- Ghana
INSERT INTO public.country_kyc_requirements (country_iso, tier, required_documents, required_fields, accepted_id_types, additional_validations, regulatory_notes) VALUES
('GH', 'tier_1', '{"government_id", "selfie"}', '{"full_name", "date_of_birth", "id_number"}', '{"Ghana Card", "Passport", "Voter''s ID", "Driver''s License"}', '{"ghana_card_verification": true}', 'Bank of Ghana guidelines'),
('GH', 'tier_2', '{"government_id", "selfie", "proof_of_address"}', '{"full_name", "date_of_birth", "id_number", "address", "tin"}', '{"Ghana Card", "Passport"}', '{"ghana_card_verification": true, "tin_verification": true}', 'TIN required for enhanced verification'),
('GH', 'tier_3', '{"government_id", "selfie", "proof_of_address", "source_of_funds"}', '{"full_name", "date_of_birth", "id_number", "address", "tin", "source_of_funds", "occupation"}', '{"Ghana Card", "Passport"}', '{"ghana_card_verification": true, "tin_verification": true, "source_of_funds_declaration": true}', 'Full CDD per BoG AML requirements')
ON CONFLICT (country_iso, tier) DO UPDATE SET
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  accepted_id_types = EXCLUDED.accepted_id_types,
  additional_validations = EXCLUDED.additional_validations,
  regulatory_notes = EXCLUDED.regulatory_notes,
  updated_at = now();

-- Default requirements for other countries
INSERT INTO public.country_kyc_requirements (country_iso, tier, required_documents, required_fields, accepted_id_types, additional_validations, regulatory_notes) VALUES
('DEFAULT', 'tier_1', '{"government_id", "selfie"}', '{"full_name", "date_of_birth", "id_number"}', '{"National ID", "Passport", "Driver''s License"}', '{}', 'Standard FATF recommendations'),
('DEFAULT', 'tier_2', '{"government_id", "selfie", "proof_of_address"}', '{"full_name", "date_of_birth", "id_number", "address"}', '{"National ID", "Passport"}', '{}', 'Enhanced due diligence'),
('DEFAULT', 'tier_3', '{"government_id", "selfie", "proof_of_address", "source_of_funds"}', '{"full_name", "date_of_birth", "id_number", "address", "source_of_funds", "occupation"}', '{"National ID", "Passport"}', '{"source_of_funds_declaration": true}', 'Full CDD per FATF')
ON CONFLICT (country_iso, tier) DO UPDATE SET
  required_documents = EXCLUDED.required_documents,
  required_fields = EXCLUDED.required_fields,
  accepted_id_types = EXCLUDED.accepted_id_types,
  additional_validations = EXCLUDED.additional_validations,
  regulatory_notes = EXCLUDED.regulatory_notes,
  updated_at = now();

-- 1.13 Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_transaction_limits_user_date ON public.user_transaction_limits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_tier ON public.kyc_verifications(kyc_tier);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status_tier ON public.kyc_verifications(status, verification_level);
CREATE INDEX IF NOT EXISTS idx_country_kyc_requirements_country ON public.country_kyc_requirements(country_iso);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_tier ON public.profiles(kyc_tier);

-- 1.14 Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_kyc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_kyc_tiers_updated_at ON public.kyc_tiers;
CREATE TRIGGER update_kyc_tiers_updated_at
BEFORE UPDATE ON public.kyc_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_kyc_updated_at();

DROP TRIGGER IF EXISTS update_country_kyc_requirements_updated_at ON public.country_kyc_requirements;
CREATE TRIGGER update_country_kyc_requirements_updated_at
BEFORE UPDATE ON public.country_kyc_requirements
FOR EACH ROW EXECUTE FUNCTION public.update_kyc_updated_at();

DROP TRIGGER IF EXISTS update_user_transaction_limits_updated_at ON public.user_transaction_limits;
CREATE TRIGGER update_user_transaction_limits_updated_at
BEFORE UPDATE ON public.user_transaction_limits
FOR EACH ROW EXECUTE FUNCTION public.update_kyc_updated_at();
