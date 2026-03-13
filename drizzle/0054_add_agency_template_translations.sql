ALTER TABLE "agency_course_templates" ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb;
