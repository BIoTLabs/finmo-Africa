-- Make user_id NOT NULL on partners table
ALTER TABLE public.partners ALTER COLUMN user_id SET NOT NULL;

-- Drop and recreate the INSERT policy to ensure it's correct
DROP POLICY IF EXISTS "Users can create own partner record" ON public.partners;
CREATE POLICY "Users can create own partner record" ON public.partners
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);