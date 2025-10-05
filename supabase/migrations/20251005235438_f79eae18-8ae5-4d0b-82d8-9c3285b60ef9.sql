-- ============================================
-- SECURITY FIX: Profiles Table RLS Hardening
-- ============================================
-- Issue: Potential exposure of user PII (email, phone, wallet address)
-- Fix: Ensure strict SELECT policy and remove any overly permissive policies

-- First, drop any existing policies on profiles to ensure clean slate
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Create strict SELECT policy: Users can ONLY view their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create UPDATE policy: Users can only update their own profile
CREATE POLICY "Users can update own profile only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create INSERT policy for user registration
-- This allows users to create their own profile during signup
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Create SECURITY DEFINER function for system-level profile creation
-- This is needed for the database trigger that creates profiles on signup
CREATE OR REPLACE FUNCTION public.can_insert_profile_for_new_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is only called from the trigger, which runs as SECURITY DEFINER
  -- It bypasses RLS to allow profile creation during user registration
  RETURN true;
END;
$$;

-- ============================================
-- SECURITY FIX: User Registry RLS
-- ============================================
-- Issue: user_registry table missing SELECT policy
-- Fix: Add strict SELECT policy

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own registry entry" ON public.user_registry;
DROP POLICY IF EXISTS "Users can insert own registry entry" ON public.user_registry;
DROP POLICY IF EXISTS "System can insert registry" ON public.user_registry;

-- Users can only view their own registry entry
CREATE POLICY "Users can view own registry entry only"
ON public.user_registry
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own registry entry
CREATE POLICY "Users can insert own registry entry"
ON public.user_registry
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Note: UPDATE and DELETE policies intentionally not added
-- Registry entries should be immutable after creation

-- ============================================
-- SECURITY FIX: Transactions Table Hardening
-- ============================================
-- Issue: Missing UPDATE policy could allow modifications
-- Fix: Explicitly prevent updates to ensure immutability

-- Transactions should be immutable - no UPDATE or DELETE allowed
-- The existing policies allow SELECT and INSERT only, which is correct
-- We'll add a comment to document this is intentional

COMMENT ON TABLE public.transactions IS 'Financial transaction records. Immutable after creation - no UPDATE or DELETE policies by design for audit trail integrity.';

-- ============================================
-- Create helper function for safe profile lookups
-- ============================================
-- This function allows looking up only non-sensitive profile data
-- Useful for displaying user info in transactions, P2P, etc.

CREATE OR REPLACE FUNCTION public.get_public_profile(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Returns only non-sensitive profile fields
  -- Email, phone_number, and wallet_address are intentionally excluded
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.bio,
    p.avatar_url
  FROM public.profiles p
  WHERE p.id = user_uuid;
END;
$$;

COMMENT ON FUNCTION public.get_public_profile IS 'Safely returns non-sensitive profile data for public display. Email, phone, and wallet address are never exposed.';