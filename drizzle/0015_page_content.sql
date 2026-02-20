-- Page Content CMS Tables
-- Stores editable page content with version history

-- Create page_content table
CREATE TABLE IF NOT EXISTS "page_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text NOT NULL,
	"content" jsonb NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	"published_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint

-- Create page_content_history table
CREATE TABLE IF NOT EXISTS "page_content_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_content_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint

-- Add foreign keys
DO $$ BEGIN
 ALTER TABLE "page_content" ADD CONSTRAINT "page_content_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "page_content_history" ADD CONSTRAINT "page_content_history_page_content_id_page_content_id_fk" FOREIGN KEY ("page_content_id") REFERENCES "public"."page_content"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "page_content_history" ADD CONSTRAINT "page_content_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes
CREATE INDEX IF NOT EXISTS "page_content_org_idx" ON "page_content" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_content_org_page_idx" ON "page_content" USING btree ("organization_id","page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_content_status_idx" ON "page_content" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_content_published_idx" ON "page_content" USING btree ("organization_id","published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_history_page_idx" ON "page_content_history" USING btree ("page_content_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_history_org_idx" ON "page_content_history" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_history_version_idx" ON "page_content_history" USING btree ("page_content_id","version");
