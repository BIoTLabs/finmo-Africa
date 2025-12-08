-- Add RLS INSERT policy for partners table to require authentication and user_id match
CREATE POLICY "Users can create own partner record"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);