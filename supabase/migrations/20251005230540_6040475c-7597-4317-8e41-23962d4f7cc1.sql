-- Update profiles table to support additional fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '{}'::jsonb;

-- Create a table for contact invitations
CREATE TABLE IF NOT EXISTS public.contact_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inviter_id, contact_phone)
);

-- Enable RLS on contact_invitations
ALTER TABLE public.contact_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_invitations
CREATE POLICY "Users can view own invitations"
  ON public.contact_invitations
  FOR SELECT
  USING (auth.uid() = inviter_id);

CREATE POLICY "Users can create own invitations"
  ON public.contact_invitations
  FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update own invitations"
  ON public.contact_invitations
  FOR UPDATE
  USING (auth.uid() = inviter_id);

CREATE POLICY "Users can delete own invitations"
  ON public.contact_invitations
  FOR DELETE
  USING (auth.uid() = inviter_id);