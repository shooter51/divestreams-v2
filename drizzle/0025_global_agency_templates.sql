-- Migration: Add agency_code and level_code to agency_course_templates
-- This allows templates to exist globally without requiring tenant-specific agency/level records

-- Add new columns for storing agency and level codes
ALTER TABLE "agency_course_templates" ADD COLUMN IF NOT EXISTS "agency_code" text;
ALTER TABLE "agency_course_templates" ADD COLUMN IF NOT EXISTS "level_code" text;

-- Create index for agency_code lookups
CREATE INDEX IF NOT EXISTS "idx_agency_templates_agency_code" ON "agency_course_templates" USING btree ("agency_code");

-- Make sure unique index allows null agency_id
DROP INDEX IF EXISTS "idx_agency_templates_code";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agency_templates_unique_code" ON "agency_course_templates" USING btree ("agency_code", "code");
