-- Reset admin wallet address and encrypted key
UPDATE profiles
SET wallet_address = '',
    wallet_private_key_encrypted = NULL
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin');

-- Clear all wallet balances
DELETE FROM wallet_balances WHERE true;

-- Reset reward transaction counters
UPDATE user_rewards
SET total_transaction_volume = 0,
    monthly_transaction_count = 0
WHERE true;

-- Create system_notifications table for admin messages
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  priority INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active notifications
CREATE POLICY "Users can view active system notifications"
ON public.system_notifications
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can create notifications
CREATE POLICY "Admins can create system notifications"
ON public.system_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update notifications
CREATE POLICY "Admins can update system notifications"
ON public.system_notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete notifications
CREATE POLICY "Admins can delete system notifications"
ON public.system_notifications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX idx_system_notifications_active ON public.system_notifications(is_active, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;