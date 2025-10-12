-- Clear all existing 2FA/MFA factors to allow fresh setup
DELETE FROM auth.mfa_factors;