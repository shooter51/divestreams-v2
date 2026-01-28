-- Migration: Add unique constraint on organization.name
-- This fixes KAN-600: Duplicate organization names can be created
--
-- Problem: Organization table only has unique constraint on slug, not name.
-- Application-level check exists but can be bypassed by race conditions or direct DB access.
--
-- Solution: Add database-level unique constraint on organization name.

-- Add unique constraint on organization name
ALTER TABLE organization
ADD CONSTRAINT organization_name_unique UNIQUE (name);

-- Create index for faster name lookups
CREATE INDEX IF NOT EXISTS organization_name_idx ON organization(name);
