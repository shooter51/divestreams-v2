CREATE TABLE "training_session_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"max_students" integer,
	"price_override" numeric(10, 2),
	"status" text NOT NULL DEFAULT 'scheduled',
	"notes" text,
	"instructor_id" text,
	"instructor_name" text,
	"enrolled_count" integer NOT NULL DEFAULT 0,
	"completed_count" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "series_index" integer;
--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "training_session_series" ADD CONSTRAINT "training_session_series_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "training_session_series" ADD CONSTRAINT "training_session_series_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_series_id_training_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."training_session_series"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_series_id_training_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."training_session_series"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "training_series_org_idx" ON "training_session_series" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "training_series_course_idx" ON "training_session_series" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "training_series_status_idx" ON "training_session_series" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "training_sessions_series_idx" ON "training_sessions" USING btree ("series_id");
