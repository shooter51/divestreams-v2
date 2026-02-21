-- Add planId column to subscription table to link with subscription_plans
-- This unifies the two disconnected subscription systems

-- Add the plan_id column (nullable for backwards compatibility)
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_plan_id ON subscription(plan_id);

-- Migrate existing data: Map "free" -> free plan, "premium" -> first paid plan
-- Note: This is best-effort migration. Manual verification recommended after running.
UPDATE subscription s
SET plan_id = (
  SELECT sp.id FROM subscription_plans sp
  WHERE CASE
    WHEN s.plan = 'free' THEN sp.monthly_price = 0
    ELSE sp.monthly_price > 0
  END
  ORDER BY sp.monthly_price ASC
  LIMIT 1
)
WHERE s.plan_id IS NULL;
