-- [DS-fjn8] Add per-tenant feature flag overrides to subscription table
-- Allows platform admins to enable/disable specific features per tenant,
-- overriding the plan-level defaults.
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "feature_overrides" jsonb;
