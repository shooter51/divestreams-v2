-- Migration: Backfill subscription planId from stripePriceId
-- This fixes DIVE-166: Plans reset on deployment, features get locked after upgrade
--
-- Problem: When users upgraded via Stripe, the webhook updated subscription status
-- but never set the planId foreign key. This caused feature checks to always use
-- the free plan even after successful payment.
--
-- Solution: Match existing stripePriceId values to subscription_plans table and
-- update the planId foreign key.

-- Backfill planId for subscriptions with monthly price IDs
UPDATE subscription
SET plan_id = sp.id,
    plan = sp.name,
    updated_at = NOW()
FROM subscription_plans sp
WHERE subscription.stripe_price_id = sp.monthly_price_id
  AND subscription.plan_id IS NULL
  AND subscription.stripe_price_id IS NOT NULL;

-- Backfill planId for subscriptions with yearly price IDs
UPDATE subscription
SET plan_id = sp.id,
    plan = sp.name,
    updated_at = NOW()
FROM subscription_plans sp
WHERE subscription.stripe_price_id = sp.yearly_price_id
  AND subscription.plan_id IS NULL
  AND subscription.stripe_price_id IS NOT NULL;

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM subscription
  WHERE plan_id IS NOT NULL AND stripe_price_id IS NOT NULL;

  RAISE NOTICE 'Backfilled % subscriptions with plan_id from stripe_price_id', updated_count;
END $$;
