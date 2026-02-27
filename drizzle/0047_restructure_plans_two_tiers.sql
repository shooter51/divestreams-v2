-- Migration 0047: Restructure subscription plans from 4 tiers to 2 (Standard / Pro)
--
-- The code (lib/plan-features.ts, lib/stripe/plan-config.ts) only recognises
-- 'standard' and 'pro'. Prior migrations seeded free / starter / pro / enterprise.
--
-- This migration:
--   1. Renames 'starter' → 'standard' in-place (preserves existing plan_id FKs)
--   2. Inserts 'standard' if neither 'starter' nor 'standard' was ever seeded
--   3. Sets correct features / limits / prices on both plans (from PLAN_CONFIGS)
--   4. Migrates subscriptions: free → standard, enterprise → pro
--   5. Updates the legacy subscription.plan text field to match
--   6. Migrates legacy tenants.plan_id for the same remapping
--   7. Deactivates the now-unused 'free' and 'enterprise' plans

-- Step 1: Rename 'starter' → 'standard' (keeps existing subscriber plan_ids intact)
UPDATE subscription_plans
SET name         = 'standard',
    display_name = 'Standard',
    updated_at   = NOW()
WHERE name = 'starter'
  AND NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'standard');--> statement-breakpoint

-- Step 2: Insert 'standard' if it still does not exist (fresh-install path)
INSERT INTO subscription_plans
  (id, name, display_name, monthly_price, yearly_price, features, limits,
   is_active, admin_modified, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'standard',
  'Standard',
  3000,
  28800,
  '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false, "has_stripe": true, "has_google_calendar": false, "has_mailchimp": false, "has_quickbooks": false, "has_zapier": false, "has_twilio": false, "has_whatsapp": false, "has_xero": false}'::jsonb,
  '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb,
  true,
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'standard');--> statement-breakpoint

-- Step 3: Sync 'standard' features / limits / prices to PLAN_CONFIGS values
--         (skip if admin has customised this plan)
UPDATE subscription_plans
SET monthly_price = 3000,
    yearly_price  = 28800,
    display_name  = 'Standard',
    features      = '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false, "has_stripe": true, "has_google_calendar": false, "has_mailchimp": false, "has_quickbooks": false, "has_zapier": false, "has_twilio": false, "has_whatsapp": false, "has_xero": false}'::jsonb,
    limits        = '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb,
    updated_at    = NOW()
WHERE name = 'standard'
  AND (admin_modified = false OR admin_modified IS NULL);--> statement-breakpoint

-- Step 4: Sync 'pro' features / limits / prices to PLAN_CONFIGS values
--         (skip if admin has customised this plan)
UPDATE subscription_plans
SET monthly_price = 10000,
    yearly_price  = 96000,
    display_name  = 'Pro',
    features      = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true, "has_stripe": true, "has_google_calendar": true, "has_mailchimp": true, "has_quickbooks": true, "has_zapier": true, "has_twilio": true, "has_whatsapp": true, "has_xero": true}'::jsonb,
    limits        = '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb,
    updated_at    = NOW()
WHERE name = 'pro'
  AND (admin_modified = false OR admin_modified IS NULL);--> statement-breakpoint

-- Step 5: Update subscription.plan (legacy text field) for 'starter' rows
--         The plan_id FK is already correct because we renamed the plan in-place above.
UPDATE subscription
SET plan       = 'standard',
    updated_at = NOW()
WHERE plan = 'starter'
  AND EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'standard');--> statement-breakpoint

-- Step 6: Migrate 'free' subscriptions → 'standard'
UPDATE subscription
SET plan       = 'standard',
    plan_id    = (SELECT id FROM subscription_plans WHERE name = 'standard' LIMIT 1),
    updated_at = NOW()
WHERE plan = 'free'
  AND EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'standard');--> statement-breakpoint

-- Step 7: Migrate 'enterprise' subscriptions → 'pro'
UPDATE subscription
SET plan       = 'pro',
    plan_id    = (SELECT id FROM subscription_plans WHERE name = 'pro' LIMIT 1),
    updated_at = NOW()
WHERE plan = 'enterprise'
  AND EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'pro');--> statement-breakpoint

-- Step 8: Migrate legacy tenants.plan_id for 'free' tenants → 'standard'
UPDATE tenants
SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'standard' LIMIT 1)
WHERE plan_id IN (SELECT id FROM subscription_plans WHERE name = 'free')
  AND EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'standard');--> statement-breakpoint

-- Step 9: Migrate legacy tenants.plan_id for 'enterprise' tenants → 'pro'
UPDATE tenants
SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'pro' LIMIT 1)
WHERE plan_id IN (SELECT id FROM subscription_plans WHERE name = 'enterprise')
  AND EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'pro');--> statement-breakpoint

-- Step 10: Deactivate the retired tiers — they no longer exist in the product
UPDATE subscription_plans
SET is_active  = false,
    updated_at = NOW()
WHERE name IN ('free', 'enterprise');
