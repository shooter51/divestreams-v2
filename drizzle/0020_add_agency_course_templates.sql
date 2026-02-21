-- Agency Course Templates
-- Templates for courses from certification agencies (PADI, SSI, etc.)
-- Can be imported and used to prepopulate training courses

CREATE TABLE IF NOT EXISTS "agency_course_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agency_id" uuid,
  "level_id" uuid,

  "name" text NOT NULL,
  "code" text,
  "description" text,
  "images" jsonb,

  "duration_days" integer DEFAULT 1 NOT NULL,
  "classroom_hours" integer DEFAULT 0,
  "pool_hours" integer DEFAULT 0,
  "open_water_dives" integer DEFAULT 0,

  "prerequisites" text,
  "min_age" integer,
  "medical_requirements" text,
  "required_items" jsonb,
  "materials_included" boolean DEFAULT true,

  "content_hash" text NOT NULL,
  "source_type" text NOT NULL,
  "source_url" text,
  "last_synced_at" timestamp,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "agency_course_templates" ADD CONSTRAINT "agency_course_templates_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agency_course_templates" ADD CONSTRAINT "agency_course_templates_level_id_certification_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."certification_levels"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_agency_templates_agency" ON "agency_course_templates" USING btree ("agency_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agency_templates_hash" ON "agency_course_templates" USING btree ("content_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agency_templates_code" ON "agency_course_templates" USING btree ("agency_id", "code");
