-- Migration: Add unique constraint on tour name per organization
-- Prevents duplicate tour names within the same organization

-- Create unique index on (organization_id, name) for tours table
CREATE UNIQUE INDEX IF NOT EXISTS "tours_org_name_idx" ON "tours" ("organization_id", "name");
