# Stripe Webhook Fix Guide

## Problem
Subscription upgrades complete in Stripe but don't update in the database because webhooks are failing signature verification.

## Root Cause
The `STRIPE_WEBHOOK_SECRET` in `.env` doesn't match the signing secret for the webhook endpoint configured in Stripe Dashboard.

## Solution

### Step 1: Check Stripe Dashboard Configuration

1. Go to https://dashboard.stripe.com/test/webhooks
2. Look for webhook endpoint: `https://demo.staging.divestreams.com/api/stripe-webhook`
3. Click on it to see the **Signing secret** (starts with `whsec_`)

### Step 2: Update VPS Environment Variable

SSH into staging VPS and update the webhook secret:

```bash
ssh root@76.13.28.28

cd /docker/divestreams-staging

# Edit .env file
nano .env

# Update this line with the signing secret from Stripe Dashboard:
STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET_HERE

# Save and restart containers
docker compose restart app worker
```

### Step 3: Test the Fix

1. Try a subscription upgrade at https://demo.staging.divestreams.com/tenant/settings/billing
2. Complete the Stripe checkout
3. Wait 30 seconds and refresh the page
4. Check if the subscription plan updated

### Step 4: Verify Webhook Success

Check the logs to confirm webhooks are working:

```bash
ssh root@76.13.28.28 "docker logs divestreams-staging-app --tail 100 | grep -E 'WEBHOOK|subscription update'"
```

You should see:
```
[WEBHOOK] Received Stripe webhook
[WEBHOOK] Payload length: 1234
[WEBHOOK] Signature present: true
[WEBHOOK] Handler success: Webhook handled successfully
📥 Processing subscription update for org...
✅ Updated subscription in database: status=active, plan=professional
```

## If Webhook Endpoint Doesn't Exist

Create a new webhook endpoint in Stripe Dashboard:

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "+ Add endpoint"
3. Enter URL: `https://demo.staging.divestreams.com/api/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** and update `.env` as shown above

## For Production

Repeat the same steps but:
- Use production webhook endpoint: `https://divestreams.com/api/stripe-webhook`
- Go to https://dashboard.stripe.com/webhooks (live mode)
- Update production VPS `.env` at `/docker/divestreams-v2/.env`

## Current Configuration

**Staging:**
- VPS: 76.13.28.28 (VPS ID: 1271895)
- URL: https://demo.staging.divestreams.com
- Mode: Test mode
- Current webhook secret: `whsec_cvZ3WYR67DrourreIddnWYDMJVMOKvKR`

**Production:**
- VPS: 72.62.166.128 (VPS ID: 1239852)
- URL: https://divestreams.com
- Mode: Live mode
