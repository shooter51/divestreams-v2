CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"monthly_price_id" text,
	"yearly_price_id" text,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"features" jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subdomain" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_id" uuid,
	"subscription_status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp,
	"current_period_end" timestamp,
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"schema_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "tenants_schema_name_unique" UNIQUE("schema_name")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "tenants_stripe_customer_idx" ON "tenants" USING btree ("stripe_customer_id");