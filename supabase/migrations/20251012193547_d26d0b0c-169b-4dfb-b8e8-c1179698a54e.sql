-- Remove all existing MFA factors from all users to allow fresh 2FA setup
-- This cleans up any stuck unverified or verified factors

DELETE FROM auth.mfa_factors;