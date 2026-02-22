# KAN-627: Subscription Upgrade Cache Invalidation Fix

## Problem

When users upgraded their subscription using a saved payment method, the upgrade would complete successfully in Stripe and the database would be updated, but users would not see the updated subscription plan in the UI. They would need to manually refresh the page after 30+ seconds to see the changes.

## Root Cause

**Systematic Debugging Analysis:**

1. **Data Flow**: When upgrading with saved payment method:
   - `createCheckoutSession()` detects saved payment method (line 146)
   - Updates subscription directly via Stripe API (line 167-179)
   - Updates database immediately (line 184-192)
   - Redirects to success URL (line 194)

2. **The Bug**: Database was updated, but Redis cache was NOT invalidated
   - Organization context loader reads from cache
   - Cache contains old subscription data
   - User sees stale plan information

3. **Evidence**:
   - `invalidateSubscriptionCache()` function exists in `lib/cache/subscription.server.ts`
   - It's used in admin panel when updating subscriptions
   - It was NEVER called in the customer-facing upgrade flow

## Solution

Added `invalidateSubscriptionCache(orgId)` calls after every database subscription update:

### Changes to `lib/stripe/index.ts`

1. **Import added** (line 5):
```typescript
import { invalidateSubscriptionCache } from "../cache/subscription.server";
```

2. **After updating existing subscription** (line ~195):
```typescript
await db.update(subscription).set({...}).where(eq(subscription.organizationId, orgId));

// Invalidate cache so user sees updated subscription immediately
await invalidateSubscriptionCache(orgId);

return successUrl;
```

3. **After creating new subscription** (line ~240):
```typescript
await db.update(subscription).set({...}).where(eq(subscription.organizationId, orgId));

// Invalidate cache so user sees updated subscription immediately
await invalidateSubscriptionCache(orgId);

return successUrl;
```

4. **After webhook updates** (line ~492):
```typescript
await db.update(subscription).set({...}).where(eq(subscription.organizationId, orgId));

// Invalidate cache so changes are immediately visible
await invalidateSubscriptionCache(orgId);
console.log(`   ✅ Invalidated subscription cache for org ${orgId}`);
```

## What Gets Invalidated

The `invalidateSubscriptionCache()` function clears these Redis keys:
- `session:${orgId}:subscription`
- `session:${orgId}:plan`
- `org:${orgId}:context`
- `org:${orgId}:limits`

This forces the next request to read fresh data from the database.

## Testing

**Test Coverage**:
- Created `tests/unit/lib/stripe/checkout-cache-invalidation.test.ts`
- All existing Stripe unit tests pass (18 tests)
- Full test suite: 3582 tests pass

**Manual Testing**:
1. User upgrades subscription with saved payment method
2. Database is updated immediately
3. Cache is invalidated
4. Redirect to billing page
5. Loader fetches fresh data from database
6. User sees updated plan immediately

## Related Issues

- **KAN-594**: Previous cache invalidation work for admin panel
- Uses the same `invalidateSubscriptionCache()` utility

## Deployment Notes

- No database migrations required
- No environment variable changes
- Backwards compatible (cache invalidation is fail-safe)
- Deploy via normal CI/CD pipeline (push to staging branch)
