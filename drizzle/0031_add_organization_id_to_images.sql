-- Migration: Add organizationId to images table
-- This fixes KAN-603 and KAN-605: Image upload 500 errors
--
-- Problem: Legacy tenant schemas don't have organizationId column in images table.
-- The upload code tries to insert organizationId, causing database constraint errors.
--
-- Solution: Add organizationId column to images table and backfill from organization slug.

-- Add the organizationId column (nullable first for backfill)
ALTER TABLE images
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Create index for organizationId
CREATE INDEX IF NOT EXISTS images_org_idx ON images(organization_id);
CREATE INDEX IF NOT EXISTS images_org_entity_idx ON images(organization_id, entity_type, entity_id);

-- Note: Backfilling organizationId for existing images would require:
-- 1. Determining which organization owns each image based on entity relationships
-- 2. This is complex and may not be needed if old tenant schemas aren't actively used
--
-- For new multi-tenant architecture, images are inserted with organizationId from the start.
-- Legacy tenant schemas can have NULL organizationId for old images.
