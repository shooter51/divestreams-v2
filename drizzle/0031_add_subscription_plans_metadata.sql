-- Migration: Add metadata field to subscription_plans for Stripe product ID storage
-- Issue: KAN-627 - Automatic Stripe integration needs to persist productId

ALTER TABLE "subscription_plans" ADD COLUMN "metadata" jsonb;
