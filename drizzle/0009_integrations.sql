-- Integrations feature tables
-- Stores third-party integration credentials and sync logs

-- Create enum for integration providers
DO $$ BEGIN
    CREATE TYPE integration_provider AS ENUM ('stripe', 'google-calendar', 'mailchimp', 'quickbooks', 'zapier', 'twilio', 'whatsapp', 'xero');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Integrations table - stores integration credentials and settings
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" integration_provider NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"account_id" text,
	"account_name" text,
	"account_email" text,
	"settings" jsonb,
	"scopes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Integration sync log table - tracks sync operations
CREATE TABLE IF NOT EXISTS "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"external_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign key constraints
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "integration_sync_log" ADD CONSTRAINT "integration_sync_log_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Indexes for integrations table
CREATE INDEX IF NOT EXISTS "integrations_org_provider_idx" ON "integrations" USING btree ("organization_id", "provider");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "integrations_org_idx" ON "integrations" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "integrations" USING btree ("provider");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "integrations_active_idx" ON "integrations" USING btree ("organization_id", "is_active");
--> statement-breakpoint

-- Indexes for integration_sync_log table
CREATE INDEX IF NOT EXISTS "integration_sync_log_integration_idx" ON "integration_sync_log" USING btree ("integration_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "integration_sync_log_status_idx" ON "integration_sync_log" USING btree ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "integration_sync_log_created_idx" ON "integration_sync_log" USING btree ("created_at");
--> statement-breakpoint

-- Add unique constraint for org+provider combination (one integration per provider per org)
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_org_provider_unique_idx" ON "integrations" USING btree ("organization_id", "provider");
