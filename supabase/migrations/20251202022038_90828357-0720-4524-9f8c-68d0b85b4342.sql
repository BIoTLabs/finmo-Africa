-- Create admin audit logs table
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID,
  target_user_phone TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_user_id);

-- RLS policies for audit logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON admin_audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert audit logs" ON admin_audit_logs
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Add suspension fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN suspended_at TIMESTAMPTZ,
  ADD COLUMN suspended_by UUID,
  ADD COLUMN suspension_reason TEXT,
  ADD COLUMN suspension_expires_at TIMESTAMPTZ;

-- Index for checking suspension status during auth
CREATE INDEX idx_profiles_suspended ON profiles(id, is_suspended) WHERE is_suspended = true;