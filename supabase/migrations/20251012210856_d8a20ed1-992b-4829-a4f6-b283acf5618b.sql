-- Delete MFA factor for user 2fb73fae-f155-47f6-922f-f3cc4f43bddd
DELETE FROM auth.mfa_factors 
WHERE user_id = '2fb73fae-f155-47f6-922f-f3cc4f43bddd';