-- Add unique constraint to contacts table to prevent duplicates
ALTER TABLE public.contacts
ADD CONSTRAINT unique_user_contact UNIQUE (user_id, contact_phone);