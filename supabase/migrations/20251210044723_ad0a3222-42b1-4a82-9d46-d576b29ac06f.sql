-- Add missing columns to supported_countries table for phone validation and admin control
ALTER TABLE public.supported_countries 
ADD COLUMN IF NOT EXISTS country_iso text,
ADD COLUMN IF NOT EXISTS flag_emoji text,
ADD COLUMN IF NOT EXISTS phone_digits integer,
ADD COLUMN IF NOT EXISTS phone_format text,
ADD COLUMN IF NOT EXISTS phone_example text,
ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_beta boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update existing countries with phone validation data
UPDATE public.supported_countries SET
  country_iso = 'NG',
  flag_emoji = '🇳🇬',
  phone_digits = 10,
  phone_format = '+234 XXX XXX XXXX',
  phone_example = '+234 803 123 4567',
  is_enabled = true,
  is_beta = false,
  region = 'West Africa',
  sort_order = 1
WHERE country_code = '+234';

UPDATE public.supported_countries SET
  country_iso = 'KE',
  flag_emoji = '🇰🇪',
  phone_digits = 9,
  phone_format = '+254 XXX XXX XXX',
  phone_example = '+254 712 345 678',
  is_enabled = true,
  is_beta = false,
  region = 'East Africa',
  sort_order = 2
WHERE country_code = '+254';

UPDATE public.supported_countries SET
  country_iso = 'ZA',
  flag_emoji = '🇿🇦',
  phone_digits = 9,
  phone_format = '+27 XX XXX XXXX',
  phone_example = '+27 82 123 4567',
  is_enabled = true,
  is_beta = false,
  region = 'Southern Africa',
  sort_order = 3
WHERE country_code = '+27';

UPDATE public.supported_countries SET
  country_iso = 'GH',
  flag_emoji = '🇬🇭',
  phone_digits = 9,
  phone_format = '+233 XX XXX XXXX',
  phone_example = '+233 24 123 4567',
  is_enabled = true,
  is_beta = false,
  region = 'West Africa',
  sort_order = 4
WHERE country_code = '+233';

UPDATE public.supported_countries SET
  country_iso = 'UG',
  flag_emoji = '🇺🇬',
  phone_digits = 9,
  phone_format = '+256 XXX XXX XXX',
  phone_example = '+256 712 345 678',
  is_enabled = true,
  is_beta = false,
  region = 'East Africa',
  sort_order = 5
WHERE country_code = '+256';

UPDATE public.supported_countries SET
  country_iso = 'TZ',
  flag_emoji = '🇹🇿',
  phone_digits = 9,
  phone_format = '+255 XXX XXX XXX',
  phone_example = '+255 712 345 678',
  is_enabled = true,
  is_beta = false,
  region = 'East Africa',
  sort_order = 6
WHERE country_code = '+255';

-- Insert new countries (disabled by default - admin must enable)
INSERT INTO public.supported_countries (country_code, country_name, country_iso, flag_emoji, phone_digits, phone_format, phone_example, is_enabled, is_beta, region, sort_order, currency_code, currency_symbol, is_active) VALUES
('+20', 'Egypt', 'EG', '🇪🇬', 10, '+20 XXX XXX XXXX', '+20 100 123 4567', false, true, 'North Africa', 10, 'EGP', 'E£', true),
('+212', 'Morocco', 'MA', '🇲🇦', 9, '+212 XXX XXX XXX', '+212 612 345 678', false, true, 'North Africa', 11, 'MAD', 'DH', true),
('+237', 'Cameroon', 'CM', '🇨🇲', 9, '+237 XXX XXX XXX', '+237 670 123 456', false, true, 'Central Africa', 12, 'XAF', 'FCFA', true),
('+225', 'Côte d''Ivoire', 'CI', '🇨🇮', 10, '+225 XX XX XXX XXX', '+225 07 12 345 678', false, true, 'West Africa', 13, 'XOF', 'CFA', true),
('+221', 'Senegal', 'SN', '🇸🇳', 9, '+221 XX XXX XXXX', '+221 77 123 4567', false, true, 'West Africa', 14, 'XOF', 'CFA', true),
('+250', 'Rwanda', 'RW', '🇷🇼', 9, '+250 XXX XXX XXX', '+250 788 123 456', false, true, 'East Africa', 15, 'RWF', 'FRw', true),
('+251', 'Ethiopia', 'ET', '🇪🇹', 9, '+251 XXX XXX XXX', '+251 911 234 567', false, true, 'East Africa', 16, 'ETB', 'Br', true),
('+263', 'Zimbabwe', 'ZW', '🇿🇼', 9, '+263 XX XXX XXXX', '+263 77 123 4567', false, true, 'Southern Africa', 17, 'ZWL', 'Z$', true),
('+267', 'Botswana', 'BW', '🇧🇼', 8, '+267 XX XXX XXX', '+267 71 234 567', false, true, 'Southern Africa', 18, 'BWP', 'P', true),
('+260', 'Zambia', 'ZM', '🇿🇲', 9, '+260 XXX XXX XXX', '+260 977 123 456', false, true, 'Southern Africa', 19, 'ZMW', 'K', true)
ON CONFLICT (country_code) DO NOTHING;

-- Create RLS policies if they don't exist
DROP POLICY IF EXISTS "Anyone can view enabled countries" ON public.supported_countries;
DROP POLICY IF EXISTS "Admins can view all countries" ON public.supported_countries;
DROP POLICY IF EXISTS "Admins can update countries" ON public.supported_countries;
DROP POLICY IF EXISTS "Admins can insert countries" ON public.supported_countries;
DROP POLICY IF EXISTS "Admins can delete countries" ON public.supported_countries;

CREATE POLICY "Anyone can view enabled countries" 
ON public.supported_countries 
FOR SELECT 
USING (is_enabled = true);

CREATE POLICY "Admins can view all countries" 
ON public.supported_countries 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update countries" 
ON public.supported_countries 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert countries" 
ON public.supported_countries 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete countries" 
ON public.supported_countries 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));