-- Create password change audit table
CREATE TABLE IF NOT EXISTS password_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('auto_generated', 'manual_entry', 'email_reset')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE password_change_audit IS 'Audit log for admin password changes. Retains IP addresses and user agents for security forensics. Review data retention policy for GDPR/compliance.';

CREATE INDEX IF NOT EXISTS idx_password_audit_target ON password_change_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_changed_by ON password_change_audit(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_org ON password_change_audit(organization_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_created ON password_change_audit(created_at);

-- Add force_password_change column to account table
ALTER TABLE account ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
