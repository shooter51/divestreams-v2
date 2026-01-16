CREATE TYPE "public"."integration_provider" AS ENUM('stripe', 'google-calendar', 'mailchimp', 'quickbooks', 'zapier', 'twilio', 'whatsapp', 'xero');--> statement-breakpoint
CREATE TABLE "customer_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text DEFAULT 'email' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp,
	"sent_by" text,
	"email_from" text,
	"email_to" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"boat_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"cost" numeric(10, 2),
	"notes" text,
	"next_maintenance_date" date,
	"next_maintenance_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_name" text DEFAULT 'Tax',
	"tax_included_in_price" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL,
	"time_format" text DEFAULT '12h' NOT NULL,
	"require_deposit_for_booking" boolean DEFAULT false NOT NULL,
	"deposit_percentage" numeric(5, 2) DEFAULT '0',
	"cancellation_policy_days" integer DEFAULT 7,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"equipment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"cost" numeric(10, 2),
	"notes" text,
	"certification_expiry" date,
	"next_service_date" date,
	"next_service_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"last_delivery_at" timestamp,
	"last_delivery_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"external_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"account_id" text,
	"account_name" text,
	"account_email" text,
	"settings" jsonb,
	"scopes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurrence_pattern" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurrence_days" jsonb;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurrence_end_date" date;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurrence_count" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurring_template_id" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "recurrence_index" integer;--> statement-breakpoint
ALTER TABLE "customer_communications" ADD CONSTRAINT "customer_communications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communications" ADD CONSTRAINT "customer_communications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_boat_id_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."boats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_created_by_organization_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_created_by_organization_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_log" ADD CONSTRAINT "integration_sync_log_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_communications_org_idx" ON "customer_communications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_communications_customer_idx" ON "customer_communications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_communications_type_idx" ON "customer_communications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "maintenance_logs_org_idx" ON "maintenance_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "maintenance_logs_boat_idx" ON "maintenance_logs" USING btree ("boat_id");--> statement-breakpoint
CREATE INDEX "maintenance_logs_performed_at_idx" ON "maintenance_logs" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_records_org_idx" ON "service_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_records_equipment_idx" ON "service_records" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "service_records_performed_at_idx" ON "service_records" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "api_keys_org_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "api_keys" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_retry_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_created_idx" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhooks_org_idx" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhooks_org_active_idx" ON "webhooks" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "integration_sync_log_integration_idx" ON "integration_sync_log" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "integration_sync_log_status_idx" ON "integration_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_sync_log_created_idx" ON "integration_sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "integrations_org_provider_idx" ON "integrations" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "integrations_org_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integrations_provider_idx" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integrations_active_idx" ON "integrations" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "equipment_org_barcode_idx" ON "equipment" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE INDEX "products_org_barcode_idx" ON "products" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE INDEX "trips_recurring_template_idx" ON "trips" USING btree ("recurring_template_id");