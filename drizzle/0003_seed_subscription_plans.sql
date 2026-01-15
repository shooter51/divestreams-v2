-- Seed default subscription plans ONLY if table is completely empty
-- This ensures admin-configured plans take precedence

-- Only insert if NO plans exist at all
INSERT INTO "subscription_plans" ("id", "name", "display_name", "monthly_price", "yearly_price", "features", "limits", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  'free',
  'Free',
  0,
  0,
  '["Up to 20 bookings/month", "50 customers", "1 team member", "Basic calendar", "Email support"]'::jsonb,
  '{"users": 1, "customers": 50, "toursPerMonth": 20, "storageGb": 1}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" LIMIT 1);--> statement-breakpoint

INSERT INTO "subscription_plans" ("id", "name", "display_name", "monthly_price", "yearly_price", "features", "limits", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  'professional',
  'Professional',
  4900,
  47000,
  '["Unlimited bookings", "Unlimited customers", "10 team members", "POS system", "Equipment rentals", "Advanced reporting", "Email notifications", "Priority support"]'::jsonb,
  '{"users": 10, "customers": -1, "toursPerMonth": -1, "storageGb": 10}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "name" != 'free' LIMIT 1)
  AND EXISTS (SELECT 1 FROM "subscription_plans" WHERE "name" = 'free');--> statement-breakpoint

INSERT INTO "subscription_plans" ("id", "name", "display_name", "monthly_price", "yearly_price", "features", "limits", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  'enterprise',
  'Enterprise',
  9900,
  95000,
  '["Everything in Professional", "Unlimited team members", "Custom integrations", "Dedicated support", "White-label options", "API access", "Custom branding"]'::jsonb,
  '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": -1}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans" WHERE "name" != 'free' AND "name" != 'professional' LIMIT 1)
  AND EXISTS (SELECT 1 FROM "subscription_plans" WHERE "name" = 'professional');
