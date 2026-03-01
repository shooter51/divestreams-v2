-- Migration: Backfill NULL planId values in subscription table
-- Issue: KAN-594 - Premium features remain locked after admin subscription upgrade
-- Root cause: subscription.planId is NULL, breaking premium feature checks
-- This migration maps legacy plan names to subscription_plans.id

-- Step 1: Backfill planId for subscriptions with NULL planId
-- Maps legacy plan string field to subscription_plans FK
UPDATE subscription s
SET plan_id = (
  SELECT sp.id
  FROM subscription_plans sp
  WHERE sp.name = s.plan
  LIMIT 1
)
WHERE s.plan_id IS NULL
  AND s.plan IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM subscription_plans sp WHERE sp.name = s.plan
  );

-- Step 2: Set free trial planId for any remaining NULL planIds
-- This ensures no subscription is left without a valid planId
UPDATE subscription s
SET plan_id = (
  SELECT sp.id
  FROM subscription_plans sp
  WHERE sp.name = 'free'
  LIMIT 1
)
WHERE s.plan_id IS NULL;

-- Verification query (should return 0 after migration)
-- SELECT COUNT(*) FROM subscription WHERE plan_id IS NULL;
