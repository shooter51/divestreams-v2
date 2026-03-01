-- Webhooks feature tables
-- Enables organizations to receive real-time event notifications

-- Webhooks table - stores webhook endpoint configurations
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

-- Webhook deliveries table - tracks delivery attempts
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

-- Foreign key constraints
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Indexes for webhooks table
CREATE INDEX "webhooks_org_idx" ON "webhooks" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX "webhooks_org_active_idx" ON "webhooks" USING btree ("organization_id", "is_active");
--> statement-breakpoint

-- Indexes for webhook_deliveries table
CREATE INDEX "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id");
--> statement-breakpoint

CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");
--> statement-breakpoint

CREATE INDEX "webhook_deliveries_retry_idx" ON "webhook_deliveries" USING btree ("status", "next_retry_at");
--> statement-breakpoint

CREATE INDEX "webhook_deliveries_created_idx" ON "webhook_deliveries" USING btree ("created_at");
