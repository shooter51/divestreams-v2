-- Migration: Add session fingerprinting for anti-replay protection
-- Recommended by DCC Team Security Review (2026-02-13)

-- Add IP address and user agent to customer sessions
ALTER TABLE customer_sessions 
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text;

-- Index for session lookup by fingerprint
CREATE INDEX IF NOT EXISTS customer_sessions_fingerprint_idx 
ON customer_sessions(ip_address, user_agent);

-- Comment for documentation
COMMENT ON COLUMN customer_sessions.ip_address IS 'Client IP address at session creation for fingerprinting';
COMMENT ON COLUMN customer_sessions.user_agent IS 'Browser user agent at session creation for fingerprinting';
