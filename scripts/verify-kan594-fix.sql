-- Verification script for KAN-594 fix
-- Run this after deploying the fix to verify all subscriptions have valid planIds

-- ==============================================================================
-- 1. CHECK FOR NULL planIds (should return 0 rows)
-- ==============================================================================
SELECT
  COUNT(*) as null_plan_id_count,
  'CRITICAL: Found subscriptions with NULL planId' as issue
FROM subscription
WHERE plan_id IS NULL;

-- ==============================================================================
-- 2. LIST ALL SUBSCRIPTIONS WITH THEIR PLAN DETAILS
-- ==============================================================================
SELECT
  s.organization_id,
  o.name as org_name,
  o.slug as org_slug,
  s.plan as legacy_plan_name,
  s.plan_id,
  sp.name as plan_name_from_fk,
  sp.display_name,
  sp.monthly_price / 100.0 as monthly_price_dollars,
  s.status,
  CASE
    WHEN s.plan_id IS NULL THEN '❌ BROKEN'
    WHEN sp.monthly_price > 0 AND s.status = 'active' THEN '✅ PREMIUM'
    ELSE '📋 FREE'
  END as access_level
FROM subscription s
LEFT JOIN organization o ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY
  CASE WHEN s.plan_id IS NULL THEN 0 ELSE 1 END,
  sp.monthly_price DESC;

-- ==============================================================================
-- 3. VERIFY SPECIFIC TEST ACCOUNT (kkudo31@protonmail.com)
-- ==============================================================================
SELECT
  u.email,
  o.name as org_name,
  o.slug as org_slug,
  s.plan as legacy_plan,
  s.plan_id,
  sp.name as actual_plan,
  sp.display_name,
  sp.monthly_price / 100.0 as monthly_price_dollars,
  s.status,
  CASE
    WHEN s.plan_id IS NULL THEN '❌ BROKEN - NULL planId'
    WHEN sp.monthly_price = 0 THEN '❌ BROKEN - Free plan, expected Enterprise'
    WHEN sp.name != 'enterprise' THEN '⚠️ WARNING - Not on Enterprise plan'
    WHEN s.status != 'active' THEN '⚠️ WARNING - Subscription not active'
    ELSE '✅ CORRECT - Enterprise with active subscription'
  END as status_check
FROM "user" u
JOIN member m ON u.id = m.user_id
JOIN organization o ON m.organization_id = o.id
LEFT JOIN subscription s ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.email = 'kkudo31@protonmail.com';

-- ==============================================================================
-- 4. FIND MISMATCHES BETWEEN LEGACY PLAN AND PLANID FK
-- ==============================================================================
SELECT
  s.organization_id,
  o.slug,
  s.plan as legacy_plan_string,
  sp.name as plan_from_fk,
  'Mismatch detected' as issue
FROM subscription s
JOIN organization o ON s.organization_id = o.id
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.plan != sp.name;

-- ==============================================================================
-- 5. COUNT SUBSCRIPTIONS BY PLAN TYPE
-- ==============================================================================
SELECT
  sp.name as plan_name,
  sp.display_name,
  sp.monthly_price / 100.0 as monthly_price_dollars,
  COUNT(s.id) as subscription_count,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN s.status = 'trialing' THEN 1 END) as trialing_count
FROM subscription_plans sp
LEFT JOIN subscription s ON s.plan_id = sp.id
GROUP BY sp.id, sp.name, sp.display_name, sp.monthly_price
ORDER BY sp.monthly_price DESC;

-- ==============================================================================
-- 6. RECENTLY UPDATED SUBSCRIPTIONS (last 24 hours)
-- ==============================================================================
SELECT
  s.organization_id,
  o.slug,
  s.plan,
  sp.display_name as plan_name,
  s.status,
  s.updated_at,
  'Recently changed' as note
FROM subscription s
JOIN organization o ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY s.updated_at DESC;
