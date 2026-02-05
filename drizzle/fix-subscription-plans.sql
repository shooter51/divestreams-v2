-- Fix subscription plans pricing and add missing starter plan
-- This migration corrects the enterprise pricing and adds the missing starter plan

BEGIN;

-- Update enterprise pricing to correct values
UPDATE subscription_plans
SET
  monthly_price = 19900,  -- $199.00
  yearly_price = 191000,  -- $1,910.00
  updated_at = NOW()
WHERE name = 'enterprise';

-- Insert starter plan if it doesn't exist
INSERT INTO subscription_plans (
  name,
  display_name,
  monthly_price,
  yearly_price,
  features,
  limits,
  is_active
)
SELECT
  'starter',
  'Starter',
  4900,  -- $49.00
  47000, -- $470.00
  '[
    "Up to 3 users",
    "500 customers",
    "Booking management",
    "Public booking site",
    "Basic reporting",
    "Email support"
  ]'::jsonb,
  '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE name = 'starter'
);

-- Verify the changes
SELECT
  name,
  display_name,
  monthly_price / 100.0 AS monthly_price_usd,
  yearly_price / 100.0 AS yearly_price_usd,
  monthly_price_id,
  yearly_price_id
FROM subscription_plans
ORDER BY monthly_price;

COMMIT;
