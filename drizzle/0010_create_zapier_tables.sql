-- Create Zapier integration tables
-- Migration: 0010_create_zapier_tables.sql

-- Zapier webhook subscriptions table
CREATE TABLE IF NOT EXISTS "zapier_webhook_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "target_url" TEXT NOT NULL,
  "filters" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_triggered_at" TIMESTAMP,
  "last_error" TEXT,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Zapier webhook delivery log table
CREATE TABLE IF NOT EXISTS "zapier_webhook_delivery_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscription_id" UUID NOT NULL REFERENCES "zapier_webhook_subscriptions"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "event_data" JSONB NOT NULL,
  "target_url" TEXT NOT NULL,
  "http_status" INTEGER,
  "response_body" TEXT,
  "error_message" TEXT,
  "attempt_number" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "delivered_at" TIMESTAMP
);

-- Zapier API keys table
CREATE TABLE IF NOT EXISTS "zapier_api_keys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "key_hash" TEXT NOT NULL UNIQUE,
  "key_prefix" TEXT NOT NULL,
  "label" TEXT,
  "last_used_at" TIMESTAMP,
  "expires_at" TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "zapier_webhooks_org_idx" ON "zapier_webhook_subscriptions"("organization_id");
CREATE INDEX IF NOT EXISTS "zapier_webhooks_event_idx" ON "zapier_webhook_subscriptions"("event_type");
CREATE INDEX IF NOT EXISTS "zapier_webhooks_active_idx" ON "zapier_webhook_subscriptions"("organization_id", "is_active");

CREATE INDEX IF NOT EXISTS "zapier_delivery_log_subscription_idx" ON "zapier_webhook_delivery_log"("subscription_id");
CREATE INDEX IF NOT EXISTS "zapier_delivery_log_status_idx" ON "zapier_webhook_delivery_log"("status");
CREATE INDEX IF NOT EXISTS "zapier_delivery_log_created_idx" ON "zapier_webhook_delivery_log"("created_at");

CREATE INDEX IF NOT EXISTS "zapier_api_keys_org_idx" ON "zapier_api_keys"("organization_id");
CREATE INDEX IF NOT EXISTS "zapier_api_keys_active_idx" ON "zapier_api_keys"("organization_id", "is_active");

-- Add comments
COMMENT ON TABLE "zapier_webhook_subscriptions" IS 'Stores REST Hooks webhook subscriptions from Zapier';
COMMENT ON TABLE "zapier_webhook_delivery_log" IS 'Logs webhook delivery attempts for debugging';
COMMENT ON TABLE "zapier_api_keys" IS 'API keys for authenticating Zapier action requests';
