-- Simple approach: Drop constraint temporarily, clean data, re-add constraint

-- Step 1: Create validation functions
CREATE OR REPLACE FUNCTION validate_e164_phone(phone_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN phone_number ~ '^\+[1-9]\d{1,14}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Delete all invalid contacts (safest approach)
DELETE FROM contacts 
WHERE contact_phone IS NOT NULL 
  AND contact_phone !~ '^\+[1-9]\d{1,14}$';

-- Step 3: Fix profiles by setting invalid numbers to NULL
UPDATE profiles 
SET phone_number = NULL
WHERE phone_number IS NOT NULL 
  AND phone_number !~ '^\+[1-9]\d{1,14}$';

-- Step 4: Add constraints
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_e164_format 
CHECK (phone_number IS NULL OR validate_e164_phone(phone_number));

ALTER TABLE contacts ADD CONSTRAINT contacts_phone_e164_format 
CHECK (contact_phone IS NULL OR validate_e164_phone(contact_phone));

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(contact_phone) WHERE contact_phone IS NOT NULL;