-- Add recurring trip fields to trips table
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurrence_pattern" TEXT;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurrence_days" JSONB;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurrence_end_date" DATE;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurrence_count" INTEGER;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurring_template_id" UUID;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "recurrence_index" INTEGER;

-- Create index for recurring template lookups
CREATE INDEX IF NOT EXISTS "trips_recurring_template_idx" ON "trips" ("recurring_template_id");

-- Add constraint for recurrence_pattern values (optional, Drizzle doesn't create ENUM here)
-- Valid values: 'daily', 'weekly', 'biweekly', 'monthly'
COMMENT ON COLUMN "trips"."recurrence_pattern" IS 'Valid values: daily, weekly, biweekly, monthly';
COMMENT ON COLUMN "trips"."recurrence_days" IS 'Array of day numbers [0-6] where 0=Sunday, 6=Saturday. Used with weekly/biweekly patterns.';
COMMENT ON COLUMN "trips"."recurring_template_id" IS 'For recurring trip instances, links back to the original template trip';
COMMENT ON COLUMN "trips"."recurrence_index" IS 'Index of this occurrence in the recurring series. 0 or null for template.';
