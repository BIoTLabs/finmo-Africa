-- Fix security definer view by setting security invoker
ALTER VIEW public.p2p_listings_public SET (security_invoker = on);