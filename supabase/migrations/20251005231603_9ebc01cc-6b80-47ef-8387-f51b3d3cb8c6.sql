-- First, let's check if there's a trigger on auth.users
-- We need to recreate it to ensure it's on the right schema

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also need to add a policy to allow the trigger to insert into profiles
-- The trigger runs with SECURITY DEFINER so it should bypass RLS, but let's make sure

-- Add a policy for system inserts into profiles (this won't affect user access)
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Add a policy for system inserts into user_registry
DROP POLICY IF EXISTS "System can insert registry" ON public.user_registry;
CREATE POLICY "System can insert registry"
  ON public.user_registry
  FOR INSERT
  WITH CHECK (true);