# Stripe Price Synchronization Guide

> **Note:** If you manage plans via the **Admin UI** (`/admin/plans`), Stripe sync is **automatic**. See [PLAN-MANAGEMENT-GUIDE.md](./PLAN-MANAGEMENT-GUIDE.md) for the recommended workflow.
>
> This guide covers the **technical details** and **alternative approaches** for advanced use cases.

## Problem
Database subscription plans can get out of sync with Stripe prices, causing:
- Incorrect pricing displayed to users
- Failed checkout sessions (missing price IDs)
- Revenue leakage (wrong amounts charged)

## Root Causes
1. **Manual edits** - Changing database directly without updating Stripe
2. **Seed script limitations** - Only sets database prices, not Stripe price IDs
3. **No validation** - No checks that database matches Stripe
4. **Environment differences** - Different prices in test vs production

## Recommended Solution: Admin UI

**Primary Method:** Use `/admin/plans` to manage subscription plans.

- ✅ Automatic Stripe product creation
- ✅ Automatic Stripe price creation/updates
- ✅ Automatic price archiving when changed
- ✅ Database automatically synced
- ✅ No manual scripts needed

See [PLAN-MANAGEMENT-GUIDE.md](./PLAN-MANAGEMENT-GUIDE.md) for full details.

## Alternative Solution: Centralized Configuration (Advanced)

> **Warning:** Only use this if you DON'T use the Admin UI. For most users, the Admin UI is simpler and handles everything automatically.

### 1. Centralized Price Configuration

**File: `lib/stripe/plan-config.ts`** (to be created)
```typescript
export const PLAN_CONFIGS = {
  free: {
    name: "free",
    displayName: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for getting started",
  },
  starter: {
    name: "starter",
    displayName: "Starter",
    monthlyPrice: 4900,  // $49
    yearlyPrice: 47000,  // $470
    description: "Perfect for small dive shops",
  },
  pro: {
    name: "pro",
    displayName: "Pro",
    monthlyPrice: 9900,  // $99
    yearlyPrice: 95000,  // $950
    description: "For growing dive shops",
  },
  enterprise: {
    name: "enterprise",
    displayName: "Enterprise",
    monthlyPrice: 19900,  // $199
    yearlyPrice: 191000, // $1,910
    description: "For large operations",
  },
} as const;
```

### 2. Automated Sync Script

**Enhanced `scripts/seed.ts`:**
- Read from centralized config
- Create/update Stripe prices
- Update database with price IDs
- Validate sync

**Run on:**
- Initial setup: `npm run db:seed`
- After price changes: `npm run stripe:sync-prices`
- CI/CD: Automatically before deployment

### 3. Validation Checks

**Runtime validation** in `lib/stripe/index.ts`:
```typescript
// Before creating checkout session
if (!priceId) {
  throw new Error(
    `Missing Stripe price ID for ${planName} (${billingPeriod}). ` +
    `Run: npm run stripe:sync-prices`
  );
}

// Verify amount matches database
const stripePrice = await stripe.prices.retrieve(priceId);
if (stripePrice.unit_amount !== plan.monthlyPrice) {
  console.warn(
    `⚠️  Price mismatch for ${planName}: ` +
    `DB=$${plan.monthlyPrice/100} Stripe=$${stripePrice.unit_amount/100}`
  );
}
```

**Pre-deployment check** in CI/CD:
```yaml
# .github/workflows/deploy-staging.yml
- name: Verify Stripe Sync
  run: npm run stripe:verify
  env:
    STRIPE_SECRET_KEY: ${{ secrets.STAGING_STRIPE_SECRET_KEY }}
```

### 4. Migration Strategy

**Database migration** to add validation:
```sql
-- Add constraint to ensure price IDs are set for paid plans
ALTER TABLE subscription_plans
ADD CONSTRAINT check_paid_plans_have_price_ids
CHECK (
  monthly_price = 0 OR (
    monthly_price_id IS NOT NULL AND
    yearly_price_id IS NOT NULL
  )
);
```

### 5. Admin Panel Integration

Add to `/tenant/settings/admin/pricing`:
- View current prices (DB vs Stripe)
- Sync button to update from Stripe
- Warning badges for mismatches
- Last sync timestamp

## Implementation Checklist

- [x] Fix current database pricing (enterprise $99 → $199)
- [x] Add starter plan to database
- [x] Create verification script (`npm run stripe:verify`)
- [x] Create setup script (`npm run stripe:setup`)
- [ ] Create centralized config file
- [ ] Enhance seed script to sync with Stripe
- [ ] Add runtime validation in checkout
- [ ] Add pre-deployment verification to CI/CD
- [ ] Add database constraint for price IDs
- [ ] Create admin panel pricing page
- [ ] Document price change process

## Price Change Process (Future)

**When changing prices:**

1. **Update central config** (`lib/stripe/plan-config.ts`)
   ```typescript
   enterprise: {
     monthlyPrice: 24900,  // Old: 19900, New: $249
     yearlyPrice: 239000,  // Old: 191000, New: $2,390
   }
   ```

2. **Create new Stripe prices**
   ```bash
   npm run stripe:setup
   ```
   This creates new price IDs (Stripe prices are immutable)

3. **Update database**
   ```bash
   npm run db:seed
   ```
   Updates `subscription_plans` with new prices and price IDs

4. **Verify sync**
   ```bash
   npm run stripe:verify
   ```
   Confirms database matches Stripe

5. **Deploy**
   ```bash
   git push origin staging
   ```
   CI/CD will verify before deploying

## Emergency: Out of Sync

If prices are out of sync in production:

1. **Verify the mismatch**
   ```bash
   ssh root@72.62.166.128
   cd /docker/divestreams-v2
   docker compose exec app npm run stripe:verify
   ```

2. **Fix database to match Stripe**
   ```sql
   -- Connect to production database
   UPDATE subscription_plans
   SET
     monthly_price = 19900,  -- Match Stripe
     yearly_price = 191000,
     monthly_price_id = 'price_xxx',  -- Get from Stripe dashboard
     yearly_price_id = 'price_yyy'
   WHERE name = 'enterprise';
   ```

3. **Or fix Stripe to match database**
   ```bash
   npm run stripe:setup  # Creates new prices
   ```

## Monitoring

**Add to monitoring dashboard:**
- Stripe webhook delivery success rate
- Price validation errors (logged)
- Failed checkout sessions
- Revenue per plan (DB vs Stripe)

**Alerts:**
- Price mismatch detected
- Missing price IDs
- Stripe API errors

## Best Practices

1. **Never edit prices manually** - Always use scripts
2. **Test in staging first** - Verify on staging VPS before production
3. **Use Stripe test mode** - For development and staging
4. **Version control prices** - All changes in git
5. **Document changes** - Why prices changed, when, by whom
6. **Communicate** - Notify team before price changes
7. **Grandfather existing** - Don't change active subscriptions

## References

- Stripe Prices API: https://stripe.com/docs/api/prices
- Stripe Products API: https://stripe.com/docs/api/products
- Stripe Checkout: https://stripe.com/docs/payments/checkout
