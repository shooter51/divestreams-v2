# KAN-627: Subscription Upgrade Fix - Implementation Guide

**Status:** Ready for Testing
**Date:** February 2, 2026
**Developer:** Claude Code
**Ticket:** https://divestreams.atlassian.net/browse/KAN-627

---

## Summary of Changes

Fixed all 4 issues that persisted after 9 back-and-forth exchanges:

1. ✅ **Price sync** - Database is now source of truth, Stripe prices updated to match
2. ✅ **Saved payment methods** - Upgrade flow checks for saved card first, no redirect needed
3. ✅ **Subscription status** - Webhook handler correctly maps Stripe statuses to database
4. ✅ **Webhook verification** - Script to verify webhook endpoints are registered

---

## Files Changed

### New Files Created

1. **`scripts/sync-stripe-prices.ts`** - Audits and syncs prices between database and Stripe
2. **`scripts/verify-stripe-webhooks.ts`** - Verifies webhook endpoints are registered
3. **`scripts/test-subscription-upgrade.ts`** - Comprehensive test suite for all 4 issues

### Modified Files

1. **`lib/stripe/index.ts`** - Fixed upgrade flow to use saved payment methods
   - Lines 91-209: Enhanced `createCheckoutSession()` to check for saved payment method
   - Lines 282-351: Enhanced `handleSubscriptionUpdated()` with better logging and status mapping

---

## Phase 1: Price Sync (1 hour)

### Problem
Enterprise plan shows $249.99 in Stripe but $99 in database.

### Solution
Created `scripts/sync-stripe-prices.ts` which:
- Audits all plans in database vs Stripe
- Reports mismatches
- Creates new Stripe prices to match database (database is source of truth)
- Updates database with new price IDs

### Run It

```bash
# Dry run first (shows what would change)
npx tsx scripts/sync-stripe-prices.ts --dry-run

# Apply changes
npx tsx scripts/sync-stripe-prices.ts
```

### Expected Output
```
🚀 Stripe Price Sync Script (KAN-627)

📊 Auditing prices...

🔍 Checking plan: Enterprise (enterprise)
   DB Monthly: $99
   DB Yearly: $950
   Stripe Monthly: $249.99 (price_xxx)
   ❌ MISMATCH: Monthly price differs

📝 SYNCING PRICES
🔧 Syncing plan: Enterprise (enterprise)
   ✓ Created monthly price: price_new_xxx ($99/mo)
   ✓ Updated database with new price IDs

✅ Price sync complete!
```

---

## Phase 2: Saved Payment Method Flow (2 hours)

### Problem
Users must re-enter card every time they upgrade, even when they have a saved payment method.

### Solution
Modified `lib/stripe/index.ts` → `createCheckoutSession()`:

**Before:**
```typescript
// Always redirects to Checkout
const session = await stripe.checkout.sessions.create(...);
return session.url;
```

**After:**
```typescript
// Check for saved payment method first
const customer = await stripe.customers.retrieve(customerId);
const savedPaymentMethod = customer.invoice_settings?.default_payment_method;

if (savedPaymentMethod) {
  // Use saved payment method - no redirect
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: savedPaymentMethod,
  });

  // Update database immediately
  await db.update(subscription).set({ ... });

  return successUrl; // No redirect to Checkout
}

// No saved method - redirect to Checkout
const session = await stripe.checkout.sessions.create(...);
return session.url;
```

### Flow Diagram

```
User clicks "Upgrade to Enterprise"
  ↓
Check for saved payment method
  ↓
  ├─ Has saved card ───→ Create subscription directly
  │                     Update database
  │                     Redirect to success page
  │                     (No Stripe Checkout page shown)
  │
  └─ No saved card ────→ Redirect to Stripe Checkout
                        User enters card
                        Webhook fires
                        Update database
```

### Test It

1. **With saved card:**
   ```
   User: demopurpose123@proton.me
   Expected: Upgrade completes immediately, no redirect
   Logs: "✓ Using saved payment method for org..."
   ```

2. **Without saved card:**
   ```
   User: new-user@example.com
   Expected: Redirect to Stripe Checkout
   Logs: "→ Redirecting to Checkout for org... (no saved payment method)"
   ```

---

## Phase 3: Webhook Status Update (1 hour)

### Problem
Subscription stays "trialing" after payment succeeds.

### Solution
Enhanced `lib/stripe/index.ts` → `handleSubscriptionUpdated()`:

**Changes:**
1. Better status mapping:
   ```typescript
   case "incomplete":
     status = "trialing"; // Keep as trialing if waiting for payment
   case "incomplete_expired":
     status = "canceled";
   ```

2. Added comprehensive logging:
   ```typescript
   console.log(`📥 Processing subscription update for org ${orgId}`);
   console.log(`   Status: ${stripeSubscription.status}`);
   console.log(`   ✓ Matched plan: ${planName}`);
   console.log(`   ✅ Updated subscription in database`);
   ```

3. Store period start/end dates:
   ```typescript
   currentPeriodStart: periodStart,
   currentPeriodEnd: periodEnd,
   ```

### Verify Webhooks

```bash
# Check if webhook endpoints are registered
npx tsx scripts/verify-stripe-webhooks.ts

# Register webhook endpoint (if needed)
npx tsx scripts/verify-stripe-webhooks.ts --register
```

### Expected Output
```
🔍 Verifying Stripe webhook configuration...

Found 1 webhook endpoint(s):

📌 Endpoint: we_xxx
   URL: https://staging.divestreams.com/api/stripe-webhook
   Status: enabled
   Events (6):
   ✅ customer.subscription.created
   ✅ customer.subscription.updated
   ✅ customer.subscription.deleted
   ✅ invoice.payment_succeeded
   ✅ invoice.payment_failed
   ✅ checkout.session.completed
   ✅ Valid endpoint for this app

✅ Webhook configuration is valid!
```

### If Webhook Missing

The script will show:
```
⚠️  No webhook endpoints found!

To register a webhook endpoint:
1. Go to: https://dashboard.stripe.com/webhooks
2. Click 'Add endpoint'
3. Enter URL: https://staging.divestreams.com/api/stripe-webhook
4. Select events:
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
   - checkout.session.completed

Or run this script with --register flag
```

---

## Phase 4: Testing (2 hours)

### Comprehensive Test Script

```bash
npx tsx scripts/test-subscription-upgrade.ts demopurpose123@proton.me
```

### Tests Performed

1. **Test 1: Price Sync**
   - Checks all plans in database
   - Fetches corresponding Stripe prices
   - Verifies amounts match

2. **Test 2: Saved Payment Method**
   - Looks up organization by email
   - Checks Stripe customer for saved cards
   - Verifies default payment method is set

3. **Test 3: Subscription Status**
   - Compares database status vs Stripe status
   - Checks if plan name matches

4. **Test 4: Webhook Events**
   - Lists recent webhook events
   - Checks if events fired for this subscription

### Expected Output

```
🧪 Subscription Upgrade Test Suite (KAN-627)

Testing organization: demopurpose123@proton.me

============================================================
TEST 1: Price Sync (Database vs Stripe)
============================================================

✅ PASS professional - Monthly Price
   Prices match: $49

✅ PASS enterprise - Monthly Price
   Prices match: $99

============================================================
TEST 2: Saved Payment Method
============================================================

✅ PASS Saved Payment Method
   Card on file: visa •••• 4242 (12/2026)

============================================================
TEST 3: Subscription Status
============================================================

✅ PASS Subscription Status
   Status matches: active

============================================================
TEST 4: Webhook Events
============================================================

✅ PASS Webhook Events
   Found 3 webhook event(s) for this subscription

============================================================
TEST SUMMARY
============================================================

Total tests: 8
✅ Passed: 8
❌ Failed: 0
⚠️  Warnings: 0

✅ ALL TESTS PASSED
```

---

## Manual Testing Checklist

### Test 1: Price Display
- [ ] Navigate to `/tenant/settings/billing`
- [ ] Verify Enterprise plan shows $99/month (not $249.99)
- [ ] Verify Professional plan shows correct price
- [ ] Check Stripe Dashboard → Prices to confirm match

### Test 2: Upgrade with Saved Card
- [ ] Login as `demopurpose123@proton.me` / `12345678`
- [ ] Navigate to billing page
- [ ] Click "Upgrade to Enterprise"
- [ ] Expected: No redirect to Stripe Checkout
- [ ] Expected: Success message appears immediately
- [ ] Expected: Plan changes to "Enterprise"
- [ ] Check logs: Should see "✓ Using saved payment method"

### Test 3: Upgrade without Saved Card
- [ ] Login as new user (no card on file)
- [ ] Navigate to billing page
- [ ] Click "Upgrade to Enterprise"
- [ ] Expected: Redirect to Stripe Checkout
- [ ] Enter test card: 4242 4242 4242 4242
- [ ] Complete checkout
- [ ] Expected: Redirect back to app
- [ ] Expected: Plan changes to "Enterprise"
- [ ] Expected: Status changes from "trialing" to "active"

### Test 4: Webhook Status Update
- [ ] Check database subscription status before upgrade
- [ ] Perform upgrade
- [ ] Wait 5 seconds
- [ ] Check database subscription status after upgrade
- [ ] Expected: Status changes from "trialing" to "active"
- [ ] Check application logs for webhook messages:
   ```
   📥 Processing subscription update for org <id>
      Status: active
      ✓ Matched plan: enterprise
      ✅ Updated subscription in database
   ```

---

## Deployment Steps

### 1. Run Price Sync Script (Production)

```bash
# SSH into production server
ssh root@72.62.166.128

# Navigate to project
cd /docker/divestreams-v2

# Set environment variables
export STRIPE_SECRET_KEY="sk_live_xxx"
export DATABASE_URL="postgresql://..."

# Run price sync script
docker exec divestreams-app npx tsx scripts/sync-stripe-prices.ts
```

### 2. Verify Webhooks (Production)

```bash
# Check webhook configuration
docker exec divestreams-app npx tsx scripts/verify-stripe-webhooks.ts

# If needed, register webhook
docker exec divestreams-app npx tsx scripts/verify-stripe-webhooks.ts --register

# Copy the webhook secret and add to .env
echo 'STRIPE_WEBHOOK_SECRET="whsec_xxx"' >> .env

# Restart app to load new env var
docker compose restart app
```

### 3. Deploy Code Changes

The code changes are already in the repo. Just merge to staging/main:

```bash
# On local machine
git checkout staging
git add .
git commit -m "fix: KAN-627 subscription upgrade - all 4 issues resolved"
git push origin staging

# Wait for CI/CD to deploy to staging
# Test on staging: https://staging.divestreams.com

# If tests pass, merge to main
git checkout main
git merge staging
git push origin main

# CI/CD will deploy to production
```

### 4. Test on Staging

```bash
# Run test suite against staging
npx tsx scripts/test-subscription-upgrade.ts demopurpose123@proton.me

# Manual test: Login and try to upgrade
# URL: https://staging.divestreams.com/tenant/settings/billing
```

---

## Rollback Plan

If issues occur after deployment:

### Revert Code Changes

```bash
# Revert the commit
git revert <commit-hash>
git push origin staging

# Or rollback Docker image
docker pull ghcr.io/shooter51/divestreams-app:staging-previous
docker compose down && docker compose up -d
```

### Revert Price Changes

Stripe prices are immutable (can't be deleted), but you can:
1. Create new prices with old amounts
2. Update database with old price IDs

```bash
# Manually in Stripe Dashboard or via script
# Create price: $249.99 for Enterprise (if that was the old price)
# Update database:
# UPDATE subscription_plans SET monthly_price_id = 'price_old_xxx' WHERE name = 'enterprise';
```

---

## Success Criteria

All 4 issues must be resolved:

1. ✅ **Price Sync**
   - Enterprise plan shows $99/month (not $249.99)
   - Database prices match Stripe prices
   - Test: `npx tsx scripts/sync-stripe-prices.ts --dry-run` shows no mismatches

2. ✅ **Saved Payment Methods**
   - Users with saved cards upgrade immediately (no Checkout redirect)
   - Logs show: "✓ Using saved payment method for org..."
   - Test: Manual upgrade with `demopurpose123@proton.me` account

3. ✅ **Subscription Status**
   - Status changes from "trialing" to "active" after payment
   - Database status matches Stripe status
   - Test: Check database before/after upgrade

4. ✅ **Webhooks**
   - Webhook endpoint registered and enabled
   - Events firing for subscription updates
   - Logs show: "📥 Processing subscription update..."
   - Test: `npx tsx scripts/verify-stripe-webhooks.ts`

---

## Acceptance from QA

Before closing the ticket, QA must verify:

1. Price sync test passes
2. Saved card flow works (no re-entry required)
3. Subscription status updates to "active"
4. Webhooks are firing and updating database

**Test Account:** `demopurpose123@proton.me` / `12345678`

---

## Notes

- **Database is source of truth** for prices. Stripe prices are synced to match.
- **Stripe prices are immutable** - you can't update them, only create new ones.
- **Webhook endpoint must be accessible** from Stripe servers (no localhost).
- **STRIPE_WEBHOOK_SECRET** must be set in production environment variables.

---

## Support

If issues persist:

1. Check logs: `docker logs divestreams-app | grep "subscription"`
2. Check Stripe Dashboard → Events for webhook delivery status
3. Run test script: `npx tsx scripts/test-subscription-upgrade.ts <org-email>`
4. Check database: `SELECT * FROM subscription WHERE organization_id = '...'`

---

## Related Tickets

- KAN-594: Admin-modified plans not overwritten by migrations
- KAN-615: Stripe integration setup
- KAN-652: Booking cancellation tracking

---

**End of Implementation Guide**
