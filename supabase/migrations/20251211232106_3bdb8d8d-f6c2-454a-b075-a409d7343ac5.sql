-- Remove old constraint that only allows 4 ID types
ALTER TABLE public.kyc_verifications 
DROP CONSTRAINT IF EXISTS kyc_verifications_id_type_check;

-- Add new constraint with all supported country-specific ID types
ALTER TABLE public.kyc_verifications 
ADD CONSTRAINT kyc_verifications_id_type_check 
CHECK (id_type = ANY (ARRAY[
  -- Universal types
  'passport', 
  'national_id', 
  'drivers_license', 
  'voters_card',
  -- Nigeria specific
  'nin_slip', 
  'international_passport',
  'bvn',
  -- South Africa specific
  'sa_id_card', 
  'sa_id_book',
  -- Ghana specific
  'ghana_card', 
  'voters_id',
  -- Kenya specific
  'kenya_id',
  'kra_pin',
  -- Tanzania specific
  'nida_id',
  -- Uganda specific
  'uganda_id'
]));