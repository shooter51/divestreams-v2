-- Migration: Add performance indexes
-- Recommended by DCC Team Architecture Review (2026-02-13)

-- Composite index for bookings queries filtered by org and date
-- Used in: getOrgContext() monthly booking counts, reports
CREATE INDEX IF NOT EXISTS bookings_org_created_idx 
ON bookings(organization_id, created_at);

-- Composite index for integrations queries filtered by org and active status
-- Used in: Integration management pages, sync operations
CREATE INDEX IF NOT EXISTS integrations_org_active_idx 
ON integrations(organization_id, is_active);

-- Index for customer lookup by email within organization
-- Used in: Customer search, login, POS
CREATE INDEX IF NOT EXISTS customers_org_email_idx 
ON customers(organization_id, email);

-- Index for tour lookup by org and active status
-- Used in: Tour listings, booking forms
CREATE INDEX IF NOT EXISTS tours_org_active_idx 
ON tours(organization_id, is_active) WHERE is_active = true;
