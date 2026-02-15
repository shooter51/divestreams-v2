-- Fix plan name mismatch between migration 0003 and 0017
-- Migration 0003 created plans: free, professional, enterprise
-- Migration 0017 expected: free, starter, pro, enterprise
-- This migration renames 'professional' to 'pro' and creates the missing 'starter' plan

-- Step 1: Rename 'professional' to 'pro' (if it exists and 'pro' doesn't)
UPDATE subscription_plans
SET name = 'pro', display_name = 'Pro'
WHERE name = 'professional'
  AND NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'pro');--> statement-breakpoint

-- Step 2: Also rename any subscription records referencing 'professional'
UPDATE subscription
SET plan = 'pro'
WHERE plan = 'professional';--> statement-breakpoint

-- Step 3: Create 'starter' plan if it doesn't exist
INSERT INTO subscription_plans (id, name, display_name, monthly_price, yearly_price, features, limits, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'starter',
  'Starter',
  2900,
  28000,
  '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": false, "has_pos": false, "has_public_site": true, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'starter');--> statement-breakpoint

-- Step 4: Re-apply boolean feature flags to all plans (in case they still have legacy string arrays)
-- Free plan (from DEFAULT_PLAN_FEATURES.free in lib/plan-features.ts)
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false, "has_stripe": true, "has_google_calendar": false, "has_mailchimp": false, "has_quickbooks": false, "has_zapier": false, "has_twilio": false, "has_whatsapp": false, "has_xero": false}'::jsonb,
  limits = '{"users": 1, "customers": 50, "toursPerMonth": 5, "storageGb": 0.5}'::jsonb
WHERE name = 'free';--> statement-breakpoint

-- Starter plan (from DEFAULT_PLAN_FEATURES.starter)
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": false, "has_pos": false, "has_public_site": true, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false, "has_stripe": true, "has_google_calendar": true, "has_mailchimp": false, "has_quickbooks": false, "has_zapier": false, "has_twilio": false, "has_whatsapp": false, "has_xero": false}'::jsonb,
  limits = '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb
WHERE name = 'starter';--> statement-breakpoint

-- Pro plan (from DEFAULT_PLAN_FEATURES.pro)
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": false, "has_stripe": true, "has_google_calendar": true, "has_mailchimp": true, "has_quickbooks": true, "has_zapier": true, "has_twilio": true, "has_whatsapp": false, "has_xero": false}'::jsonb,
  limits = '{"users": 10, "customers": 5000, "toursPerMonth": 100, "storageGb": 25}'::jsonb
WHERE name = 'pro';--> statement-breakpoint

-- Enterprise plan
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true, "has_stripe": true, "has_google_calendar": true, "has_mailchimp": true, "has_quickbooks": true, "has_zapier": true, "has_twilio": true, "has_whatsapp": true, "has_xero": true}'::jsonb,
  limits = '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb
WHERE name = 'enterprise';
