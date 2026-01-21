-- Create team_members table for storing team member profiles
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "bio" text,
  "image_url" text,
  "email" text,
  "phone" text,
  "certifications" jsonb DEFAULT '[]'::jsonb,
  "years_experience" integer,
  "specialties" jsonb DEFAULT '[]'::jsonb,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "team_members_org_idx" ON "team_members" ("organization_id");
CREATE INDEX IF NOT EXISTS "team_members_org_public_idx" ON "team_members" ("organization_id", "is_public");
CREATE INDEX IF NOT EXISTS "team_members_org_status_idx" ON "team_members" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "team_members_display_order_idx" ON "team_members" ("organization_id", "display_order");
