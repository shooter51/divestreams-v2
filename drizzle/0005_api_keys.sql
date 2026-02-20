-- API Keys table for external integrations
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" text NOT NULL,
  "permissions" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
-- Index on organization_id for listing keys
CREATE INDEX IF NOT EXISTS "api_keys_org_idx" ON "api_keys" ("organization_id");

--> statement-breakpoint
-- Index on key_hash for fast key validation lookup
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");

--> statement-breakpoint
-- Index for listing active keys per organization
CREATE INDEX IF NOT EXISTS "api_keys_active_idx" ON "api_keys" ("organization_id", "is_active");
