-- Stripe Integration Tables (DIVE-ci5)
-- Comprehensive database schema for Stripe payments, subscriptions, and invoices

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS "stripe_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL UNIQUE,
	"stripe_customer_id" text NOT NULL UNIQUE,
	"email" text NOT NULL,
	"name" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create stripe_subscriptions table
CREATE TABLE IF NOT EXISTS "stripe_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL UNIQUE,
	"stripe_customer_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" text NOT NULL,
	"plan_name" text,
	"plan_interval" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS "stripe_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL UNIQUE,
	"stripe_customer_id" text NOT NULL,
	"stripe_invoice_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"payment_method_type" text,
	"payment_method_brand" text,
	"payment_method_last4" text,
	"failure_code" text,
	"failure_message" text,
	"receipt_email" text,
	"receipt_url" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS "stripe_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_invoice_id" text NOT NULL UNIQUE,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"invoice_number" text,
	"amount_due" integer NOT NULL,
	"amount_paid" integer NOT NULL,
	"amount_remaining" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"total" integer NOT NULL,
	"tax" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp,
	"hosted_invoice_url" text,
	"invoice_pdf" text,
	"description" text,
	"line_items" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes for stripe_customers
CREATE INDEX IF NOT EXISTS "stripe_customers_org_idx" ON "stripe_customers" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_customers_stripe_id_idx" ON "stripe_customers" USING btree ("stripe_customer_id");
--> statement-breakpoint

-- Create indexes for stripe_subscriptions
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_org_idx" ON "stripe_subscriptions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_stripe_id_idx" ON "stripe_subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_customer_idx" ON "stripe_subscriptions" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_status_idx" ON "stripe_subscriptions" USING btree ("status");
--> statement-breakpoint

-- Create indexes for stripe_payments
CREATE INDEX IF NOT EXISTS "stripe_payments_org_idx" ON "stripe_payments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_intent_idx" ON "stripe_payments" USING btree ("stripe_payment_intent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_customer_idx" ON "stripe_payments" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_invoice_idx" ON "stripe_payments" USING btree ("stripe_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_status_idx" ON "stripe_payments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_created_idx" ON "stripe_payments" USING btree ("created_at");
--> statement-breakpoint

-- Create indexes for stripe_invoices
CREATE INDEX IF NOT EXISTS "stripe_invoices_org_idx" ON "stripe_invoices" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_invoices_stripe_id_idx" ON "stripe_invoices" USING btree ("stripe_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_invoices_customer_idx" ON "stripe_invoices" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_invoices_subscription_idx" ON "stripe_invoices" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_invoices_status_idx" ON "stripe_invoices" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_invoices_created_idx" ON "stripe_invoices" USING btree ("created_at");
