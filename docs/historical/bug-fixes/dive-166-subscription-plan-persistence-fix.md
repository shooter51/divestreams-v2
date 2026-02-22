# DIVE-166: Fix Subscription Plan Persistence

**Issue**: Plans reset on deployment, features get locked after upgrade
**Related Jira**: KAN-594
**Status**: Fixed
**Date**: 2026-01-27

## Problem Summary

Users reported that after upgrading their subscription plan via Stripe:
1. The upgrade payment succeeded
2. Features remained locked (still showing free plan restrictions)
3. Plans reset to "free" after deployment/restart

## Root Cause Analysis

### The Bug

The system had **THREE CRITICAL FLAWS** in the subscription upgrade flow:

1. **Missing planId Update**: `handleSubscriptionUpdated()` in `/lib/stripe/index.ts` only updated:
   - `stripeSubscriptionId`
   - `status`
   - `currentPeriodEnd`

   It **NEVER updated the `planId` or `plan` fields**, so the subscription stayed pointing to the free plan.

2. **Stale Plan Data**: Feature checks in `/lib/auth/org-context.server.ts` query the database using `subscription.planId`. Since this was never updated, it continued to fetch FREE plan features even after successful payment.

3. **No Price-to-Plan Mapping**: The webhook receives a Stripe subscription with a `price_id`, but there was no logic to:
   - Look up which plan corresponds to that `price_id`
   - Update the `subscription.planId` FK to point to the correct plan

## Solution Implemented

### 1. Enhanced `handleSubscriptionUpdated()` Function

**File**: `/lib/stripe/index.ts`

**Changes**:
- Added logic to extract `priceId` from Stripe subscription
- Query `subscription_plans` table to find matching plan (monthly OR yearly price)
- Update BOTH `planId` (FK) and `plan` (legacy string field) in the subscription record
- Update `stripePriceId` for audit trail

**Code**:
```typescript
// Get the price ID from the subscription
const item = stripeSubscription.items.data[0];
const priceId = item?.price?.id;

// Look up the plan by matching the price ID (monthly or yearly)
let planId: string | null = null;
let planName = "free";

if (priceId) {
  const [matchedPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(
      or(
        eq(subscriptionPlans.monthlyPriceId, priceId),
        eq(subscriptionPlans.yearlyPriceId, priceId)
      )
    )
    .limit(1);

  if (matchedPlan) {
    planId = matchedPlan.id;
    planName = matchedPlan.name;
  }
}

// Update subscription with plan reference
await db
  .update(subscription)
  .set({
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId || null,
    planId: planId,  // ← CRITICAL FIX
    plan: planName,  // ← CRITICAL FIX
    status: status,
    currentPeriodEnd: periodEnd,
    updatedAt: new Date(),
  })
  .where(eq(subscription.organizationId, orgId));
```

### 2. Database Migration for Backfill

**File**: `/drizzle/0022_backfill_subscription_plan_ids.sql`

**Purpose**: Fix existing subscriptions that have `stripePriceId` but no `planId`

**What it does**:
1. Matches existing `stripePriceId` values to `subscription_plans.monthlyPriceId`
2. Matches existing `stripePriceId` values to `subscription_plans.yearlyPriceId`
3. Updates `planId` and `plan` fields for all matched subscriptions
4. Logs the number of records backfilled

This migration will run automatically on next deployment via Docker entrypoint.

### 3. Comprehensive Test Suite

**File**: `/tests/subscription-plan-persistence.test.ts`

**Test Coverage**:
- ✅ Verify `planId` is updated when Stripe subscription is upgraded
- ✅ Verify `planId` persists across application restarts (simulates deployment)
- ✅ Handle yearly price IDs correctly
- ✅ Fall back to free plan if price ID not recognized

## How Feature Checks Work Now

**Before Fix**:
```typescript
// subscription.planId was NULL
// → Fell back to legacy "plan" field (still "free")
// → Fetched free plan features
// → User stayed locked out
```

**After Fix**:
```typescript
// subscription.planId is set to correct plan UUID
// → Queries subscription_plans table via FK
// → Fetches correct plan features and limits
// → User gets access to paid features
```

## Testing the Fix

### Manual Testing Steps

1. **Create a test subscription upgrade**:
   ```bash
   # Trigger Stripe webhook with checkout.session.completed
   # or customer.subscription.updated
   ```

2. **Verify database state**:
   ```sql
   SELECT
     s.organization_id,
     s.plan,
     s.plan_id,
     s.stripe_price_id,
     sp.name as plan_name,
     sp.display_name
   FROM subscription s
   LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
   WHERE s.organization_id = 'YOUR_ORG_ID';
   ```

   Expected result:
   - `plan_id` should be a UUID (not NULL)
   - `plan` should match the upgraded plan name
   - `plan_name` and `display_name` should show the correct plan

3. **Verify feature access**:
   - Log in to the upgraded organization
   - Check that paid features are now accessible
   - No "upgrade required" messages should appear

### Automated Testing

```bash
npm run test tests/subscription-plan-persistence.test.ts
```

## Deployment Notes

### Staging Deployment
```bash
git checkout staging
git merge <feature-branch>
git push origin staging
```

The CI/CD pipeline will:
1. Run tests (including new subscription tests)
2. Build Docker image with migration
3. Deploy to staging VPS
4. Migration runs automatically on container start
5. Backfills any existing subscriptions

### Production Deployment
```bash
git checkout main
git merge staging
git push origin main
```

## Prevention Measures

To prevent this bug from happening again:

1. **Always update foreign keys in webhooks** - When Stripe sends subscription data, map it to our plan IDs
2. **Test subscription flows end-to-end** - The new test suite catches this regression
3. **Verify feature checks query database** - Feature enforcement should NEVER rely on cache or in-memory state

## Related Issues

- DIVE-166: Fix subscription plan persistence across deployments
- KAN-594: Plans and features reset on deployment (Jira)

## Files Modified

- `/lib/stripe/index.ts` - Enhanced `handleSubscriptionUpdated()` with plan lookup
- `/drizzle/0022_backfill_subscription_plan_ids.sql` - Migration to fix existing subscriptions
- `/tests/subscription-plan-persistence.test.ts` - Comprehensive test coverage

## Impact

**Before**: Users upgraded → paid money → still locked out of features
**After**: Users upgrade → payment succeeds → immediate access to all paid features

This fix ensures that subscription upgrades work correctly and persist across deployments, solving the critical issue where customers paid but didn't receive their features.
