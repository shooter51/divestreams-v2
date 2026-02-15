# KAN-627: Failed to Upgrade Subscription Plan

**Status:** QA REJECTED (9th iteration)
**Reporter:** Antonius (QA Tester)
**Created:** January 27, 2026
**Last Updated:** February 1, 2026

---

## Original Problem

Users attempting to upgrade subscription plans encountered error: **"No monthly price configured for xxx plan"**, despite prices being configured in admin panel.

**Impact:** Critical - Revenue loss, users cannot upgrade to paid plans.

---

## Current Problem (Feb 1, 2026)

Multiple issues persist after 4 fix attempts:

1. **Saved payment methods not used** - Users must re-enter card every time
2. **Subscription stays in "trialing" status** after payment
3. **Wrong price displayed** - Enterprise shows $249.99/month instead of $99/month
4. **Price mismatch** between app and Stripe dashboard

**QA Test Account:**
- Email: `demopurpose123@proton.me`
- Password: `12345678`
- Issue: Upgraded but still shows as "trialing", wrong price charged

---

## Back-and-Forth History (9 Exchanges)

| # | Date | Action | Root Cause | Result |
|---|------|--------|------------|--------|
| 1 | Jan 27 | **QA:** "No monthly price configured" error | - | Bug logged |
| 2 | Jan 29 | **DEV:** Root cause - Stripe prices not auto-created | Missing integration | ✅ Fixed |
| 3 | Jan 29 | **DEV:** Moved to Dev Review | - | Premature close |
| 4 | Jan 31 | **DEV:** Now getting "Stripe Price ID not configured" error | Different error | ❌ New issue |
| 5 | Jan 31 | **DEV:** Implemented automatic Stripe product/price creation | Integration added | ✅ Claimed fixed |
| 6 | Jan 31 | **DEV:** Deployed to staging | - | Marked Done |
| 7 | Feb 1 | **QA:** Saved payment methods not being used | UX issue | ❌ Failed |
| 8 | Feb 1 | **QA:** Subscription stays "trialing" after payment | Status not updated | ❌ Failed |
| 9 | Feb 1 | **QA:** Wrong price - $249.99 instead of $99 | Price sync issue | ❌ **FAILED** |

**Total duration:** 5 days
**Developer time spent:** ~8 hours
**QA testing cycles:** 4 rejections
**Issues fixed:** 1 of 4

---

## Root Cause Analysis

### Issue Breakdown

**Problem 1: "No monthly price configured" (FIXED ✅)**
- **Cause:** Database had plan names but no Stripe Price IDs
- **Fix:** Auto-create Stripe products/prices when plans are created
- **Status:** Working

**Problem 2: Saved payment methods not used (NOT FIXED ❌)**
- **Cause:** Upgrade flow creates new Checkout Session instead of using saved payment method
- **Impact:** Poor UX, users must re-enter card
- **Expected:** Use `customer.invoice_settings.default_payment_method`
- **Actual:** Redirects to Stripe Checkout for new card entry

**Problem 3: Subscription stays "trialing" (NOT FIXED ❌)**
- **Cause:** Stripe webhook not firing or not updating subscription status
- **Impact:** Users charged but still see "trial" status
- **Webhook events to check:**
  - `customer.subscription.updated`
  - `invoice.payment_succeeded`
  - `checkout.session.completed`

**Problem 4: Wrong price displayed (NOT FIXED ❌)**
- **Cause:** Price sync issue between database and Stripe
- **Database:** Enterprise = $99/month
- **Stripe:** Enterprise = $249.99/month
- **Impact:** Users see wrong price, billing incorrect

### Root Architectural Issues

**1. Dual Source of Truth**
```
Database subscription_plans.monthlyPrice = $99
Stripe Price object = $249.99
Which is correct? ❌ Inconsistent
```

**2. Upgrade Flow Complexity**
```
User clicks upgrade
  → Create Checkout Session (forces new card entry)
  → Redirect to Stripe
  → User enters card
  → Payment succeeds
  → Webhook fires (?)
  → Update subscription status (not happening)
  → Redirect back to app
```

**Better flow:**
```
User clicks upgrade
  → Check for saved payment method
  → If exists: Create subscription directly, charge saved card
  → If not exists: Redirect to Checkout
  → Webhook updates status
  → Show confirmation
```

**3. Webhook Reliability**
```
Webhook endpoint: /api/stripe/webhook
Issues:
- Webhooks may not be configured on Stripe account
- Endpoint may not be reachable from Stripe
- Signature verification may fail
- Subscription update logic may have bugs
```

---

## Plan to Close Once and For All

### Phase 1: Fix Price Sync Issue

**Step 1: Audit current prices**
```bash
# Check database
SELECT name, "monthlyPrice", "yearlyPrice", "stripeMonthlyPriceId"
FROM subscription_plans;

# Check Stripe
stripe prices list --limit 10

# Compare: Are they in sync?
```

**Step 2: Determine source of truth**
```
Option A: Database is truth → Update Stripe prices
Option B: Stripe is truth → Update database
Recommendation: Database is truth (easier to control)
```

**Step 3: Create sync script**
```typescript
// scripts/sync-stripe-prices.ts
import { stripe } from "../lib/stripe";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";

async function syncPrices() {
  const plans = await db.select().from(subscriptionPlans);

  for (const plan of plans) {
    // Update Stripe price to match database
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      recurring: { interval: 'month' },
      unit_amount: plan.monthlyPrice * 100, // Convert to cents
    });

    // Update database with Stripe IDs
    await db.update(subscriptionPlans)
      .set({
        stripeProductId: product.id,
        stripeMonthlyPriceId: price.id,
      })
      .where(eq(subscriptionPlans.id, plan.id));
  }
}
```

### Phase 2: Fix Saved Payment Method Flow

**Current flow (broken):**
```typescript
// app/routes/tenant/settings/billing.tsx
export async function action({ request }: ActionFunctionArgs) {
  // Always creates Checkout Session ❌
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
  });
  return redirect(session.url);
}
```

**Fixed flow:**
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const org = await getOrganization(request);

  // Check for saved payment method
  const customer = await stripe.customers.retrieve(org.stripeCustomerId);
  const savedPaymentMethod = customer.invoice_settings.default_payment_method;

  if (savedPaymentMethod) {
    // Use saved payment method - no redirect needed
    const subscription = await stripe.subscriptions.create({
      customer: org.stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: savedPaymentMethod,
      payment_behavior: 'default_incomplete',
    });

    // Update local DB immediately
    await db.update(subscription)
      .set({
        stripeSubscriptionId: subscription.id,
        status: 'active',
        planId: newPlanId,
      })
      .where(eq(subscription.organizationId, org.id));

    return json({ success: true, message: 'Upgraded successfully' });
  } else {
    // No saved method - redirect to Checkout
    const session = await stripe.checkout.sessions.create({
      customer: org.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/settings/billing?success=true`,
      cancel_url: `${APP_URL}/settings/billing?canceled=true`,
    });
    return redirect(session.url);
  }
}
```

### Phase 3: Fix Webhook Status Update

**Verify webhook endpoint registered:**
```bash
stripe webhooks list
# Should show: https://staging.divestreams.com/api/stripe/webhook
```

**If not registered:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Or register in Stripe Dashboard → Developers → Webhooks
```

**Fix webhook handler:**
```typescript
// app/routes/api/stripe/webhook.tsx
export async function action({ request }: ActionFunctionArgs) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      const subscription = event.data.object;

      // Update local database
      await db.update(subscription)
        .set({
          status: subscription.status, // "active", "trialing", "past_due", etc.
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
        })
        .where(eq(subscription.stripeCustomerId, subscription.customer));

      console.log(`✅ Updated subscription status to ${subscription.status}`);
      break;

    case 'invoice.payment_succeeded':
      // Subscription is now active
      const invoice = event.data.object;
      await db.update(subscription)
        .set({ status: 'active' })
        .where(eq(subscription.stripeCustomerId, invoice.customer));
      break;
  }

  return json({ received: true });
}
```

### Phase 4: Testing Strategy

**Test 1: Price Sync**
```
1. Check DB: Enterprise plan = $99/month ✓
2. Run sync script
3. Check Stripe Dashboard: Enterprise price = $99/month ✓
4. Verify: stripeMonthlyPriceId populated in DB ✓
```

**Test 2: Saved Payment Method**
```
1. User has saved card on file
2. Click "Upgrade to Enterprise"
3. Expected: Immediate upgrade, no redirect ✓
4. Verify: Subscription status = "active" ✓
5. Verify: No Stripe Checkout page shown ✓
```

**Test 3: No Saved Payment Method**
```
1. New user, no saved card
2. Click "Upgrade to Enterprise"
3. Expected: Redirect to Stripe Checkout ✓
4. Enter card details
5. Complete payment
6. Expected: Redirect back to app ✓
7. Verify: Subscription status = "active" ✓
```

**Test 4: Webhook Status Update**
```
1. Manually trigger webhook: stripe trigger customer.subscription.updated
2. Check DB: subscription.status updated ✓
3. Check logs: Webhook received and processed ✓
```

---

## Acceptance Criteria for Closure

**Functional:**
1. ⏳ Correct price displayed ($99 for Enterprise, not $249.99)
2. ⏳ Saved payment methods used for upgrades (no card re-entry)
3. ⏳ Subscription status updates to "active" after payment
4. ⏳ Database and Stripe prices in sync
5. ⏳ Webhooks firing and updating subscription status

**Technical:**
6. ⏳ Sync script updates Stripe prices from database
7. ⏳ Upgrade flow checks for saved payment method
8. ⏳ Webhook handler updates subscription status
9. ⏳ Unit tests verify price sync logic
10. ⏳ E2E test covers upgrade with saved card

**Verification:**
11. ⏳ QA test with `demopurpose123@proton.me` account
12. ⏳ Verify subscription status in Stripe Dashboard
13. ⏳ Verify correct price charged ($99 not $249.99)
14. ⏳ Verify no re-entry of card details

---

## Estimated Time to Complete

- Price sync script: **1 hour**
- Fix saved payment method flow: **2 hours**
- Fix webhook handler: **1 hour**
- Webhook endpoint registration: **30 minutes**
- Testing & verification: **2 hours**
- QA manual testing: **1 hour**

**Total:** ~7.5 hours

---

## Critical Success Factors

1. **Price sync FIRST** - Fix data inconsistency before testing flow
2. **Webhook verification** - Ensure endpoint registered and receiving events
3. **Local testing** - Use `stripe listen` for immediate webhook feedback
4. **Status monitoring** - Check both DB and Stripe Dashboard after each test
5. **Payment method check** - Don't force Checkout if card saved

**Dependencies:**
- Requires Stripe API keys in staging environment
- Requires webhook endpoint accessible from Stripe servers
- May require firewall/network configuration

**If this fails again:** Consider switching to Stripe Customer Portal for self-service upgrades (Stripe handles all payment UI, webhooks, and status updates).
