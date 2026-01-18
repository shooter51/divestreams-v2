-- Remove deprecated API keys and webhooks tables
-- DIVE-031: Remove API access and webhooks functionality
--
-- This migration removes the deprecated API keys and webhooks features
-- while preserving Stripe webhooks and OAuth integration callbacks.

-- Drop webhook deliveries table first (has foreign key to webhooks)
DROP TABLE IF EXISTS "webhook_deliveries" CASCADE;

-- Drop webhooks table
DROP TABLE IF EXISTS "webhooks" CASCADE;

-- Drop API keys table
DROP TABLE IF EXISTS "api_keys" CASCADE;
