CREATE TABLE "certification_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
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
	"agency_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"level_number" integer DEFAULT 1 NOT NULL,
	"description" text,
	"prerequisites" text,
	"min_age" integer,
	"min_dives" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"agency_id" uuid,
	"level_id" uuid,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"classroom_hours" integer DEFAULT 0,
	"pool_hours" integer DEFAULT 0,
	"open_water_dives" integer DEFAULT 0,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deposit_required" boolean DEFAULT false,
	"deposit_amount" numeric(10, 2),
	"min_students" integer DEFAULT 1,
	"max_students" integer DEFAULT 6 NOT NULL,
	"materials_included" boolean DEFAULT true,
	"equipment_included" boolean DEFAULT true,
	"included_items" jsonb,
	"required_items" jsonb,
	"min_age" integer,
	"prerequisites" text,
	"required_cert_level" uuid,
	"medical_requirements" text,
	"images" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"progress" jsonb,
	"skill_checkoffs" jsonb,
	"certification_number" text,
	"certification_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"location" text,
	"meeting_point" text,
	"instructor_id" text,
	"instructor_name" text,
	"max_students" integer,
	"price_override" numeric(10, 2),
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certification_agencies" ADD CONSTRAINT "certification_agencies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_level_id_certification_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."certification_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_required_cert_level_certification_levels_id_fk" FOREIGN KEY ("required_cert_level") REFERENCES "public"."certification_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cert_agencies_org_idx" ON "certification_agencies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_agencies_org_code_idx" ON "certification_agencies" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cert_levels_org_idx" ON "certification_levels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cert_levels_agency_idx" ON "certification_levels" USING btree ("agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_levels_org_code_idx" ON "certification_levels" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "training_courses_org_idx" ON "training_courses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_courses_agency_idx" ON "training_courses" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "training_courses_level_idx" ON "training_courses" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "training_courses_public_idx" ON "training_courses" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "training_enrollments_org_idx" ON "training_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_session_idx" ON "training_enrollments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_customer_idx" ON "training_enrollments" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_enrollments_unique_idx" ON "training_enrollments" USING btree ("session_id","customer_id");--> statement-breakpoint
CREATE INDEX "training_sessions_org_idx" ON "training_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_sessions_course_idx" ON "training_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_sessions_date_idx" ON "training_sessions" USING btree ("organization_id","start_date");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("organization_id","status");