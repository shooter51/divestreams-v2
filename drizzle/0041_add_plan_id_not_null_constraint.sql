-- Migration: Add NOT NULL constraint to subscription.plan_id
-- Issue: KAN-594 - Prevent future NULL planId values
-- This migration runs AFTER 0034 backfills all existing NULL values

-- Verify no NULL planIds exist before adding constraint
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM subscription
  WHERE plan_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: % subscriptions have NULL plan_id. Run migration 0034 first.', null_count;
  END IF;
END $$;

-- Add NOT NULL constraint to prevent future NULL planIds
ALTER TABLE subscription
ALTER COLUMN plan_id SET NOT NULL;

-- Add comment explaining the constraint
COMMENT ON COLUMN subscription.plan_id IS '[KAN-594] FK to subscription_plans. This is the authoritative field for premium feature checks. Never NULL.';
