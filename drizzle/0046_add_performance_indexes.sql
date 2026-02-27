-- Migration: Add missing performance indexes
--
-- Adds composite indexes identified as missing from the schema analysis.
-- These cover:
--   1. member (organization_id, role)      — per-request permission checks
--   2. trips (organization_id, date, status) — trips list with combined filters
--   3. training_enrollments (organization_id, status) — enrollment dashboard filters
--   4. certification_levels (organization_id, is_active) — course dropdowns
--   5. invitation (inviter_id)             — foreign key missing index
--
-- Note: CONCURRENTLY requires each statement to run outside a transaction block,
-- so each is separated by a statement-breakpoint marker.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "member_org_role_idx"
  ON "member" ("organization_id", "role");--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "trips_org_date_status_idx"
  ON "trips" ("organization_id", "date", "status");--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "training_enrollments_org_status_idx"
  ON "training_enrollments" ("organization_id", "status");--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "cert_levels_org_active_idx"
  ON "certification_levels" ("organization_id", "is_active");--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_inviter_id_idx"
  ON "invitation" ("inviter_id");
