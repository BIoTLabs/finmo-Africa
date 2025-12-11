-- Make address column nullable for Tier 1 submissions that don't require address
ALTER TABLE public.kyc_verifications ALTER COLUMN address DROP NOT NULL;

-- Set default empty string for address to prevent issues
ALTER TABLE public.kyc_verifications ALTER COLUMN address SET DEFAULT '';