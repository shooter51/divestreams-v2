# KAN-627: QA Test Plan - Subscription Upgrade Fix

**Date:** February 2, 2026
**Ticket:** https://divestreams.atlassian.net/browse/KAN-627
**Test Account:** `demopurpose123@proton.me` / `12345678`

---

## What Was Fixed

After 9 back-and-forth exchanges, all 4 persisting issues have been addressed:

1. ✅ **Price sync** - Enterprise shows $99 (not $249.99)
2. ✅ **Saved payment methods used** - No card re-entry required
3. ✅ **Subscription status updates** - Changes from "trialing" to "active"
4. ✅ **Webhooks firing** - Events are delivered and processed

---

## Prerequisites

Before testing, ensure:

1. **Stripe is configured:**
   ```bash
   # Check environment variables are set
   echo $STRIPE_SECRET_KEY
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. **Database prices are synced:**
   ```bash
   npm run stripe:sync-prices -- --dry-run
   npm run stripe:sync-prices
   ```

3. **Webhooks are registered:**
   ```bash
   npm run stripe:verify-webhooks
   ```

---

## Test Case 1: Price Sync Verification

**Objective:** Verify correct prices are displayed (not old cached prices)

### Steps

1. Navigate to billing page: `/tenant/settings/billing`
2. Check plan prices displayed:
   - Free: $0/month ✓
   - Professional: $49/month ✓
   - Enterprise: $99/month ✓ (NOT $249.99)

### Expected Results

- ✅ Enterprise shows "$99/month"
- ✅ Yearly price shown: "$950/year (save 20%)"
- ✅ Prices match Stripe Dashboard

### Verification

```bash
# Run price sync test
npm run stripe:test-upgrade demopurpose123@proton.me

# Look for output:
# ✅ PASS enterprise - Monthly Price
#    Prices match: $99
```

### Pass Criteria

- [ ] Enterprise plan displays $99/month on billing page
- [ ] Stripe Dashboard shows price_xxx with $99 amount
- [ ] Test script confirms prices match

---

## Test Case 2: Upgrade with Saved Payment Method

**Objective:** Verify saved cards are used (no Stripe Checkout redirect)

### Steps

1. Login as test user: `demopurpose123@proton.me` / `12345678`
2. Navigate to: `/tenant/settings/billing`
3. Verify "Payment Method" section shows saved card
4. Click "Upgrade" button on Enterprise plan
5. **DO NOT enter card details** - watch what happens

### Expected Results

- ✅ No redirect to Stripe Checkout page
- ✅ Success message appears immediately: "Payment successful! Your subscription has been updated."
- ✅ Current plan updates to "Enterprise"
- ✅ Page refreshes showing new plan
- ✅ Logs show: "✓ Using saved payment method for org..."

### What Should NOT Happen

- ❌ Should NOT redirect to `checkout.stripe.com`
- ❌ Should NOT show card entry form
- ❌ Should NOT require re-entering card details

### Verification

```bash
# Check application logs
docker logs divestreams-app | grep "saved payment method"

# Should see:
# ✓ Using saved payment method for org <id>: pm_xxx
# ✓ Created subscription sub_xxx with saved payment method
```

### Pass Criteria

- [ ] Saved card shown in "Payment Method" section
- [ ] Clicking upgrade does NOT redirect to Stripe
- [ ] Success message appears within 2 seconds
- [ ] Plan changes to "Enterprise" immediately
- [ ] No card entry form shown

---

## Test Case 3: Subscription Status Update

**Objective:** Verify status changes from "trialing" to "active" after payment

### Steps

1. Login as test user
2. Navigate to billing page
3. Note current subscription status (check badge next to plan name)
4. Perform upgrade (from Test Case 2)
5. Wait 5 seconds for webhook processing
6. Refresh page
7. Check subscription status badge

### Expected Results

- ✅ Before: Status badge shows "trialing" (blue)
- ✅ After: Status badge shows "active" (green)
- ✅ Database `subscription.status` = 'active'
- ✅ Stripe Dashboard shows subscription status = "Active"

### Verification

```bash
# Check database status
psql $DATABASE_URL -c "
  SELECT s.status, s.plan, sp.display_name
  FROM subscription s
  JOIN organization o ON s.organization_id = o.id
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE o.slug = 'demo';
"

# Should show:
# status | plan       | display_name
# -------+------------+-------------
# active | enterprise | Enterprise
```

### Alternative Check (if no database access)

```bash
npm run stripe:test-upgrade demopurpose123@proton.me

# Look for:
# ✅ PASS Subscription Status
#    Status matches: active
```

### Pass Criteria

- [ ] Status badge changes from "trialing" (blue) to "active" (green)
- [ ] Database shows status = 'active'
- [ ] Stripe Dashboard shows "Active" status
- [ ] Test script confirms status matches

---

## Test Case 4: Webhook Event Processing

**Objective:** Verify webhooks are firing and updating database

### Steps

1. Before upgrade, check Stripe Dashboard → Developers → Events
2. Perform upgrade (Test Case 2)
3. Wait 10 seconds
4. Check Stripe Dashboard → Developers → Events again
5. Check application logs

### Expected Results

- ✅ New events appear in Stripe Dashboard:
  - `customer.subscription.updated` or `customer.subscription.created`
  - `invoice.payment_succeeded`
  - `checkout.session.completed` (only if Checkout was used)
- ✅ Application logs show webhook processing:
  ```
  📥 Processing subscription update for org <id>: sub_xxx
     Status: active
     Price ID: price_xxx
     ✓ Matched plan: enterprise (<id>)
     ✅ Updated subscription in database: status=active, plan=enterprise
  ```
- ✅ Database updated within 5 seconds of webhook delivery

### Verification

```bash
# Check application logs for webhook events
docker logs divestreams-app | grep "Processing subscription"

# Or run test script
npm run stripe:test-upgrade demopurpose123@proton.me

# Look for:
# ✅ PASS Webhook Events
#    Found 3 webhook event(s) for this subscription
```

### Pass Criteria

- [ ] Webhook events appear in Stripe Dashboard
- [ ] Events show "Succeeded" delivery status
- [ ] Application logs show webhook processing messages
- [ ] Database updates within 5 seconds
- [ ] Test script confirms webhook events exist

---

## Test Case 5: New User Flow (No Saved Card)

**Objective:** Verify Checkout redirect still works when no saved payment method

### Steps

1. Create new organization (or use one without saved card)
2. Navigate to billing page
3. Click "Upgrade to Enterprise"
4. **Expect redirect** to Stripe Checkout

### Expected Results

- ✅ Redirects to `checkout.stripe.com`
- ✅ Shows card entry form
- ✅ Can enter test card: `4242 4242 4242 4242`
- ✅ After completion, redirects back to app
- ✅ Success message appears
- ✅ Plan updates to "Enterprise"
- ✅ Status changes to "active"

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### Pass Criteria

- [ ] Redirects to Stripe Checkout
- [ ] Card entry form shown
- [ ] Test card completes successfully
- [ ] Redirects back to app with success message
- [ ] Plan and status update correctly

---

## Automated Test Suite

Run the comprehensive test script:

```bash
npm run stripe:test-upgrade demopurpose123@proton.me
```

### Expected Output

```
🧪 Subscription Upgrade Test Suite (KAN-627)

============================================================
TEST SUMMARY
============================================================

Total tests: 8
✅ Passed: 8
❌ Failed: 0
⚠️  Warnings: 0

✅ ALL TESTS PASSED
```

### If Tests Fail

Check the detailed output for which test failed:

```
❌ FAIL enterprise - Monthly Price
   Mismatch: DB=$99, Stripe=$249.99
```

Then run the appropriate fix:

```bash
# If price sync fails
npm run stripe:sync-prices

# If webhook verification fails
npm run stripe:verify-webhooks
```

---

## Regression Testing

Ensure existing functionality still works:

### Test Case R1: Downgrade Plan

1. Start with Enterprise plan
2. Click "Switch" on Professional plan
3. Expected: Downgrade scheduled for end of period
4. Expected: Still have access to Enterprise features until period ends

### Test Case R2: Cancel Subscription

1. Scroll to "Cancel Subscription" section
2. Click "Cancel Subscription"
3. Confirm dialog
4. Expected: Status changes to "canceled"
5. Expected: Access retained until period end

### Test Case R3: Update Payment Method

1. Click "Manage Payment" button
2. Expected: Redirect to Stripe Billing Portal
3. Add/update card
4. Expected: Redirect back to app
5. Expected: Payment method updated

---

## Sign-Off Checklist

Before marking KAN-627 as "Done", verify:

### Functional Requirements

- [ ] Test Case 1: Price sync - Enterprise shows $99 ✓
- [ ] Test Case 2: Saved card flow - No redirect to Checkout ✓
- [ ] Test Case 3: Status update - Changes from "trialing" to "active" ✓
- [ ] Test Case 4: Webhooks - Events firing and processing ✓
- [ ] Test Case 5: New user flow - Checkout redirect works ✓

### Technical Requirements

- [ ] Automated test suite passes (8/8 tests) ✓
- [ ] No errors in application logs ✓
- [ ] Database status matches Stripe status ✓
- [ ] Webhook endpoints registered and enabled ✓

### Regression Tests

- [ ] Downgrade plan still works ✓
- [ ] Cancel subscription still works ✓
- [ ] Update payment method still works ✓

### Documentation

- [ ] Implementation guide reviewed ✓
- [ ] QA test plan followed ✓
- [ ] Any issues documented ✓

---

## Known Issues / Limitations

None at this time. All 4 original issues have been resolved.

---

## Rollback Instructions

If critical issues found:

```bash
# Revert code changes
git revert <commit-hash>
git push origin staging

# Or rollback Docker image
docker pull ghcr.io/shooter51/divestreams-app:staging-previous
docker compose down && docker compose up -d
```

---

## Contact

**Developer:** Claude Code
**Ticket:** KAN-627
**Documentation:** `/docs/KAN-627_IMPLEMENTATION_GUIDE.md`

For questions or issues, comment on the Jira ticket.

---

**End of QA Test Plan**
