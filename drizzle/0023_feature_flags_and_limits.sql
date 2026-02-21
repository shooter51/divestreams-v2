-- Update existing plans with new feature structure and limits
-- This replaces old feature format with new boolean flags

-- Free plan: Tours & Bookings only
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 1, "customers": 50, "toursPerMonth": 5, "storageGb": 0.5}'::jsonb
WHERE name = 'free';

-- Starter plan: + Equipment & Boats, + Public Site
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": false, "has_pos": false, "has_public_site": true, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb
WHERE name = 'starter';

-- Pro plan: + Training, + POS, + Advanced Notifications
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 10, "customers": 5000, "toursPerMonth": 100, "storageGb": 25}'::jsonb
WHERE name = 'pro';

-- Enterprise plan: All features, unlimited usage (-1)
UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true}'::jsonb,
  limits = '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb
WHERE name = 'enterprise';
