-- QuickBooks sync tables
-- Stores mappings between DiveStreams and QuickBooks entities

-- Create enum for QuickBooks entity types
DO $$ BEGIN
    CREATE TYPE quickbooks_sync_entity AS ENUM ('customer', 'invoice', 'payment', 'item');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create enum for QuickBooks sync status
DO $$ BEGIN
    CREATE TYPE quickbooks_sync_status AS ENUM ('pending', 'synced', 'failed', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- QuickBooks sync records table - maps DiveStreams entities to QuickBooks entities
CREATE TABLE IF NOT EXISTS "quickbooks_sync_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" uuid NOT NULL,
	"entity_type" quickbooks_sync_entity NOT NULL,
	"divestreams_id" text NOT NULL,
	"quickbooks_id" text NOT NULL,
	"sync_status" quickbooks_sync_status DEFAULT 'synced' NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- QuickBooks item mappings table - maps DiveStreams products to QuickBooks items
CREATE TABLE IF NOT EXISTS "quickbooks_item_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" uuid NOT NULL,
	"divestreams_product_type" text NOT NULL,
	"divestreams_product_id" text,
	"quickbooks_item_id" text NOT NULL,
	"quickbooks_item_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign key constraints
ALTER TABLE "quickbooks_sync_records" ADD CONSTRAINT "quickbooks_sync_records_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "quickbooks_sync_records" ADD CONSTRAINT "quickbooks_sync_records_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "quickbooks_item_mappings" ADD CONSTRAINT "quickbooks_item_mappings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "quickbooks_item_mappings" ADD CONSTRAINT "quickbooks_item_mappings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Indexes for quickbooks_sync_records
CREATE INDEX IF NOT EXISTS "qb_sync_org_entity_idx" ON "quickbooks_sync_records" USING btree ("organization_id", "entity_type", "divestreams_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "qb_sync_integration_idx" ON "quickbooks_sync_records" USING btree ("integration_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "qb_sync_status_idx" ON "quickbooks_sync_records" USING btree ("sync_status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "qb_sync_quickbooks_id_idx" ON "quickbooks_sync_records" USING btree ("quickbooks_id");
--> statement-breakpoint

-- Indexes for quickbooks_item_mappings
CREATE INDEX IF NOT EXISTS "qb_mapping_org_idx" ON "quickbooks_item_mappings" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "qb_mapping_integration_idx" ON "quickbooks_item_mappings" USING btree ("integration_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "qb_mapping_product_idx" ON "quickbooks_item_mappings" USING btree ("organization_id", "divestreams_product_type", "divestreams_product_id");
--> statement-breakpoint

-- Unique constraint for DiveStreams entity mapping (one QuickBooks ID per entity)
CREATE UNIQUE INDEX IF NOT EXISTS "qb_sync_entity_unique_idx" ON "quickbooks_sync_records" USING btree ("organization_id", "entity_type", "divestreams_id");
