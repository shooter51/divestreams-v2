-- Fix KAN-594: Prevent subscription plan features from being overwritten on every deployment
-- Problem: Migrations 0017 and 0020 contain UNCONDITIONAL UPDATE statements that run on every deployment
-- Solution: Add admin_modified column and make future updates conditional

-- Step 1: Add admin_modified flag to track admin customizations
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS admin_modified BOOLEAN DEFAULT false;--> statement-breakpoint

-- Step 2: Mark all existing plans as NOT admin-modified (they have default features from migrations)
-- This allows one more update to fix any plans that were created before the feature flag conversion
UPDATE subscription_plans
SET admin_modified = false
WHERE admin_modified IS NULL;--> statement-breakpoint

-- Step 3: Re-apply feature flags ONLY to plans that haven't been customized
-- This is the LAST TIME these updates will run unconditionally

-- Free plan: Tours & Bookings only
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 1, "customers": 50, "toursPerMonth": 5, "storageGb": 0.5}'::jsonb,
  admin_modified = false
WHERE name = 'free' AND admin_modified = false;--> statement-breakpoint

-- Starter plan: + Equipment & Boats, + Public Site
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": false, "has_pos": false, "has_public_site": true, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb,
  admin_modified = false
WHERE name = 'starter' AND admin_modified = false;--> statement-breakpoint

-- Pro plan: + Training, + POS, + Advanced Notifications
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 10, "customers": 5000, "toursPerMonth": 100, "storageGb": 25}'::jsonb,
  admin_modified = false
WHERE name = 'pro' AND admin_modified = false;--> statement-breakpoint

-- Enterprise plan: All features, unlimited usage (-1)
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true}'::jsonb,
  limits = '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb,
  admin_modified = false
WHERE name = 'enterprise' AND admin_modified = false;--> statement-breakpoint

-- Step 4: Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_subscription_plans_admin_modified ON subscription_plans(admin_modified);
