-- Migration: Backfill subscription planId from plan name
-- This fixes KAN-594: Premium features remain locked after admin updates subscription
--
-- Problem: When admin creates new org or updates subscription via admin panel,
-- the planId foreign key was not being set, only the legacy 'plan' string field.
-- This caused isPremium checks to fail even with paid plans.
--
-- Solution: Match existing 'plan' name values to subscription_plans.name and
-- update the planId foreign key for subscriptions where planId is NULL.

-- Backfill planId for subscriptions with plan names but no planId
UPDATE subscription
SET plan_id = sp.id,
    updated_at = NOW()
FROM subscription_plans sp
WHERE subscription.plan = sp.name
  AND subscription.plan_id IS NULL
  AND sp.is_active = true;

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM subscription
  WHERE plan_id IS NOT NULL;

  RAISE NOTICE 'Backfilled % total subscriptions with plan_id', updated_count;
END $$;
