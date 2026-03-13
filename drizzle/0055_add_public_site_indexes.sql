-- Add indexes to speed up public site queries (trips_list, courses, equipment, images)
-- These indexes target the exact WHERE/JOIN/ORDER BY patterns used by getPublicTrips,
-- getPublicCourses, getPublicEquipment, and image lookups.

-- 1. Trips: composite index for public listing query
-- WHERE (organization_id, is_public, status, date) ORDER BY date
CREATE INDEX IF NOT EXISTS "trips_org_public_status_date_idx"
  ON "trips" ("organization_id", "is_public", "status", "date");

-- 2. Images: composite index including isPrimary for JOIN filter
-- JOIN ON (organization_id, entity_type, entity_id) WHERE is_primary = true
CREATE INDEX IF NOT EXISTS "images_org_entity_primary_idx"
  ON "images" ("organization_id", "entity_type", "entity_id", "is_primary");

-- 3. Equipment: composite index for public listing query
-- WHERE (organization_id, is_public, status) ORDER BY category
CREATE INDEX IF NOT EXISTS "equipment_org_public_status_idx"
  ON "equipment" ("organization_id", "is_public", "status", "category");

-- 4. Training sessions: composite index for EXISTS subquery in courses listing
-- WHERE (course_id, status, start_date)
CREATE INDEX IF NOT EXISTS "training_sessions_course_status_date_idx"
  ON "training_sessions" ("course_id", "status", "start_date");
