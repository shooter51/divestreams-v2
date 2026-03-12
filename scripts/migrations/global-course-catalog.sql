-- Migration: Global Course Catalog Architecture
-- Transforms training courses from copied data to template references.
-- training_courses becomes a thin reference table (templateId FK + tenant-customizable fields).
-- agency_course_templates becomes the single source of truth for course content.
-- Images are stored globally on templates (S3 URLs).
-- Translations stored in JSONB on templates for global i18n.

-- Step 1: Add translations column to agency_course_templates
ALTER TABLE agency_course_templates
  ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}';

-- Step 2: Add image_override column to training_courses
-- Tenants can optionally override template images
ALTER TABLE training_courses
  ADD COLUMN IF NOT EXISTS image_override jsonb;

-- Step 3: Make templateId the primary reference for catalog courses
-- (templateId already exists but was optional — keep it optional for custom courses)
-- No schema change needed here, just noting the semantic shift.

-- Step 4: Clean up agency_course_templates — drop tenant-specific FKs
-- These columns reference tenant-scoped tables which doesn't make sense for global templates.
-- We keep agencyCode/levelCode for identification.
ALTER TABLE agency_course_templates
  DROP COLUMN IF EXISTS agency_id,
  DROP COLUMN IF EXISTS level_id;

-- Step 5: Add unique constraint to prevent duplicate template enablement per tenant
-- A tenant should only be able to enable a given template once.
CREATE UNIQUE INDEX IF NOT EXISTS training_courses_org_template_uniq
  ON training_courses (organization_id, template_id)
  WHERE template_id IS NOT NULL;

-- Note: training_courses.name, description, images, etc. remain in the table
-- but become "custom_*" fields used only when templateId IS NULL.
-- When templateId IS NOT NULL, the application reads from the template.
-- This avoids a destructive column drop and lets us migrate gradually.
