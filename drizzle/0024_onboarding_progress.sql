-- Onboarding Progress Table
-- Tracks user progress through the onboarding wizard

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "completed_tasks" jsonb DEFAULT '[]'::jsonb,
  "dismissed" boolean DEFAULT false,
  "dismissed_at" timestamp with time zone,
  "current_section" text,
  "tour_completed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "onboarding_progress_user_id_idx" ON "onboarding_progress" ("user_id");
