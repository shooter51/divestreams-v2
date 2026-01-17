CREATE TABLE "certification_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"website" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"level" integer NOT NULL,
	"description" text,
	"prerequisites" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"session_type" text NOT NULL,
	"session_number" integer DEFAULT 1 NOT NULL,
	"scheduled_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text,
	"dive_site_id" uuid,
	"instructor_ids" jsonb,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"max_students" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_checkoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"session_id" uuid,
	"skill_name" text NOT NULL,
	"skill_category" text DEFAULT 'basic' NOT NULL,
	"status" text DEFAULT 'not_attempted' NOT NULL,
	"instructor_id" text,
	"checked_off_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"agency_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"schedule_type" text DEFAULT 'fixed' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2),
	"max_students" integer DEFAULT 6 NOT NULL,
	"min_instructors" integer DEFAULT 1 NOT NULL,
	"total_sessions" integer DEFAULT 1 NOT NULL,
	"has_exam" boolean DEFAULT false NOT NULL,
	"exam_pass_score" integer,
	"min_open_water_dives" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_scheduling' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"deposit_amount" numeric(10, 2),
	"deposit_paid_at" timestamp,
	"total_price" numeric(10, 2) NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"pos_transaction_ids" jsonb,
	"exam_score" integer,
	"exam_passed_at" timestamp,
	"certification_number" text,
	"certified_at" timestamp,
	"prerequisite_override" boolean DEFAULT false NOT NULL,
	"prerequisite_override_by" text,
	"prerequisite_override_note" text,
	"instructor_notes" text,
	"student_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certification_agencies" ADD CONSTRAINT "certification_agencies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_checkoffs" ADD CONSTRAINT "skill_checkoffs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_checkoffs" ADD CONSTRAINT "skill_checkoffs_enrollment_id_training_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_checkoffs" ADD CONSTRAINT "skill_checkoffs_session_id_course_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_checkoffs" ADD CONSTRAINT "skill_checkoffs_instructor_id_user_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_level_id_certification_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."certification_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certification_agencies_org_idx" ON "certification_agencies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "certification_agencies_code_idx" ON "certification_agencies" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "certification_levels_org_idx" ON "certification_levels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "certification_levels_agency_idx" ON "certification_levels" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "certification_levels_level_idx" ON "certification_levels" USING btree ("organization_id","level");--> statement-breakpoint
CREATE INDEX "course_sessions_org_idx" ON "course_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "course_sessions_course_idx" ON "course_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_sessions_enrollment_idx" ON "course_sessions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "course_sessions_date_idx" ON "course_sessions" USING btree ("organization_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "course_sessions_status_idx" ON "course_sessions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "course_sessions_dive_site_idx" ON "course_sessions" USING btree ("dive_site_id");--> statement-breakpoint
CREATE INDEX "skill_checkoffs_org_idx" ON "skill_checkoffs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skill_checkoffs_enrollment_idx" ON "skill_checkoffs" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "skill_checkoffs_session_idx" ON "skill_checkoffs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "skill_checkoffs_status_idx" ON "skill_checkoffs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "skill_checkoffs_instructor_idx" ON "skill_checkoffs" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "training_courses_org_idx" ON "training_courses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_courses_agency_idx" ON "training_courses" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "training_courses_level_idx" ON "training_courses" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "training_courses_active_idx" ON "training_courses" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "training_enrollments_org_idx" ON "training_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_course_idx" ON "training_enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_customer_idx" ON "training_enrollments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_status_idx" ON "training_enrollments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "training_enrollments_payment_idx" ON "training_enrollments" USING btree ("organization_id","payment_status");