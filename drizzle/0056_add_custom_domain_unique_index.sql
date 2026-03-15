-- Migration: Add unique index on organization.custom_domain
-- Issue: DS-dn9 - Prevent multiple orgs from claiming the same custom domain
-- The application-level check has a race condition; this DB constraint is authoritative.
-- NULL values are excluded from unique indexes in PostgreSQL, so orgs without
-- custom domains are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS "organization_custom_domain_idx"
  ON "organization" ("custom_domain")
  WHERE "custom_domain" IS NOT NULL;
