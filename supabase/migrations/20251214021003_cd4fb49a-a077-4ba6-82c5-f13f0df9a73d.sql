-- Allow users to upgrade their approved KYC to a higher tier
-- This policy enables UPDATE on approved records if the new status is set to pending
CREATE POLICY "Users can upgrade own approved KYC" 
ON kyc_verifications 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND status = 'approved'
)
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'pending'
);