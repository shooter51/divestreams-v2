# Subscription Upgrade Testing Guide

## What Was Fixed

### 1. Webhook Route (CRITICAL FIX)
**Problem**: Route was registered as `api/stripe/webhook` but handler file was `stripe-webhook.tsx`, causing 404 errors.

**Fix**: Updated `app/routes.ts` line 13:
```typescript
// BEFORE (404 errors):
route("api/stripe/webhook", "routes/api/stripe-webhook.tsx"),

// AFTER (working):
route("api/stripe-webhook", "routes/api/stripe-webhook.tsx"),
```

**Verification**:
```bash
curl -X POST https://demo.staging.divestreams.com/api/stripe-webhook \
  -H "stripe-signature: test" \
  -d '{"test": true}'
# Returns HTTP 400 (signature invalid) ✅ - endpoint exists
# Previously returned HTTP 404 (route not found) ❌
```

### 2. User Feedback Message
**Problem**: Success toast appeared immediately after checkout, before webhook processed.

**Fix**: Changed `billing.tsx` lines 342-345:
```typescript
// BEFORE (lying to user):
type: "success",
message: "Your subscription has been updated successfully!"

// AFTER (honest):
type: "info",
message: "Payment successful! Your subscription is being updated. This may take a few moments. Please refresh the page in 30 seconds."
```

### 3. Enhanced Logging
Added detailed webhook debugging logs in `stripe-webhook.tsx`:
- Request received confirmation
- Payload size
- Signature presence
- Secret configuration
- Handler success/failure messages

## Current Configuration

**Staging Environment:**
- **URL**: https://demo.staging.divestreams.com
- **Webhook Endpoint**: https://demo.staging.divestreams.com/api/stripe-webhook
- **Webhook Secret**: `whsec_cvZ3WYR67DrourreIddnWYDMJVMOKvKR`
- **Stripe Mode**: Test mode

## Stripe Dashboard Verification

**IMPORTANT**: Verify the webhook endpoint in Stripe Dashboard matches the fixed route:

1. Go to https://dashboard.stripe.com/test/webhooks
2. Look for endpoint: `https://demo.staging.divestreams.com/api/stripe-webhook`
3. If it shows `/api/stripe/webhook` (old route), update it:
   - Click the webhook endpoint
   - Update endpoint URL to: `https://demo.staging.divestreams.com/api/stripe-webhook`
   - Click "Update endpoint"

4. Verify signing secret matches `.env`:
   - Click on the webhook endpoint
   - Click "Reveal" next to **Signing secret**
   - Should match: `whsec_cvZ3WYR67DrourreIddnWYDMJVMOKvKR`

## Test Plan

### Test 1: Webhook Endpoint Accessibility ✅ PASSED
```bash
bash /tmp/test-webhook.sh
```
**Expected**: HTTP 400 (signature invalid)
**Actual**: HTTP 400 ✅
**Status**: PASSED - Endpoint is reachable

### Test 2: Subscription Upgrade Flow

1. **Login to demo tenant**:
   - URL: https://demo.staging.divestreams.com/tenant/login
   - Check current plan in Settings → Billing

2. **Start subscription upgrade**:
   - Click "Change Plan" or "Upgrade"
   - Select different plan (e.g., Professional)
   - Click "Subscribe" or "Upgrade"

3. **Complete Stripe checkout**:
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry (e.g., 12/34)
   - Any CVC (e.g., 123)
   - Click "Subscribe"

4. **Verify user feedback**:
   - Should see INFO toast (blue): "Payment successful! Your subscription is being updated. This may take a few moments. Please refresh the page in 30 seconds."
   - Should NOT see immediate success (green) toast

5. **Wait and verify webhook processing**:
   ```bash
   # Check webhook logs
   ssh root@76.13.28.28 "docker logs divestreams-staging-app --tail 100 | grep -E 'WEBHOOK|subscription'"
   ```
   **Expected logs**:
   ```
   [WEBHOOK] Received Stripe webhook
   [WEBHOOK] Payload length: [some number]
   [WEBHOOK] Signature present: true
   [WEBHOOK] Handler success: Webhook handled successfully
   📥 Processing subscription update for org...
   ✅ Updated subscription in database: status=active, plan=professional
   ```

6. **Verify database update**:
   - Wait 30 seconds
   - Refresh Settings → Billing page
   - Check if "Current Plan" shows new plan
   - Check if subscription status shows "Active"

### Test 3: Webhook Event Logs in Stripe

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on the webhook endpoint
3. Click "Events" tab
4. Find the `checkout.session.completed` event from your test
5. Check status:
   - ✅ **Succeeded** (2xx response) - Webhook processed successfully
   - ❌ **Failed** (4xx/5xx response) - Check error message

## Expected Results

### ✅ Success Indicators
- Webhook endpoint returns 400 for test (not 404) ✅
- Stripe dashboard shows webhook events with "Succeeded" status
- App logs show "[WEBHOOK] Handler success"
- App logs show "✅ Updated subscription in database"
- Billing page shows new plan after refresh
- No signature verification errors in logs

### ❌ Failure Indicators
- 404 errors (wrong route) - Fixed by our changes
- 400 errors with "No signatures found matching" - Secret mismatch
- Webhook never fires - Endpoint URL wrong in Stripe Dashboard
- Success logs but no database update - Check subscription update logic

## Troubleshooting

### If Webhook Still Fails with Signature Error

**Check Stripe Dashboard endpoint URL**:
- Must be: `https://demo.staging.divestreams.com/api/stripe-webhook`
- NOT: `https://demo.staging.divestreams.com/api/stripe/webhook` (old)

**Verify webhook secret**:
```bash
ssh root@76.13.28.28 "cd /docker/divestreams-staging && grep STRIPE_WEBHOOK_SECRET .env"
```
Should match secret in Stripe Dashboard.

**Restart containers if secret changed**:
```bash
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose restart app worker"
```

### If Database Doesn't Update

Check organization subscription logic:
```bash
ssh root@76.13.28.28 "docker exec divestreams-staging-db psql -U divestreams -d divestreams -c \"SELECT id, name, subscription_plan_id, subscription_status FROM organizations WHERE subdomain='demo';\""
```

## Files Changed

- `app/routes.ts` - Fixed webhook route path
- `app/routes/tenant/settings/billing.tsx` - Improved user feedback message
- `app/routes/api/stripe-webhook.tsx` - Enhanced logging
- `docs/WEBHOOK_FIX_GUIDE.md` - Created comprehensive webhook setup guide
- `docs/SUBSCRIPTION_UPGRADE_TEST.md` - This file

## Deployed

- **Commit**: Latest (includes webhook route fix)
- **Image**: `ghcr.io/shooter51/divestreams-app:staging`
- **Deployed**: 2026-02-03 (just now)
- **VPS**: 76.13.28.28 (staging)

## Next Steps

1. ✅ Webhook endpoint accessible (verified)
2. ⏳ **Test actual subscription upgrade** (ready to test)
3. ⏳ Verify webhook processes successfully
4. ⏳ Verify database updates
5. ⏳ Test on production after staging verification
