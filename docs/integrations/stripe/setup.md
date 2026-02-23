# Stripe Configuration Guide

This guide walks you through configuring Stripe for the DiveStreams multi-tenant SaaS platform.

## Overview

Your DiveStreams application has comprehensive Stripe integration including:
- **Subscription management** (Starter, Pro, Enterprise plans)
- **Customer management** with Stripe syncing
- **Billing portal** for customer self-service
- **Webhook handling** for payment events
- **Payment method management**
- **Stripe Terminal support** for POS payments
- **Comprehensive audit trail** via database tables

## Step 1: Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete identity verification and business details
3. Your account will start in **Test Mode** (recommended for development)

## Step 2: Create Restricted API Keys (Security Best Practice)

For production security, use **Restricted API Keys** instead of standard keys. This limits what each key can do if compromised.

### Quick Overview:
- **Backend Key**: Limited to specific Stripe operations (no read access to all data)
- **Frontend Key**: Read-only access, minimal permissions for browser use
- **Standard Keys**: Full access (older method, less secure)

### Create Your Keys:

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Scroll down to **Restricted Keys** section
4. Click **Create restricted key** (do this twice - once for backend, once for frontend)

**See STRIPE_RESTRICTED_KEYS.md for detailed permission setup**

### Or Use Standard Keys (for quick testing):

If you want to get started quickly:
1. Navigate to **Developers** → **API Keys**
2. In the **Standard Keys** section, you'll see:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

### Test Mode vs Live Mode:
- **Test Mode**: Recommended for development. Use test card numbers provided by Stripe
- **Live Mode**: Only enable when you're ready to accept real payments

## Step 3: Configure Environment Variables

Copy your keys to your `.env` file:

```env
# Required: Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Optional: Webhook signing secret (set up after webhook configuration)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Required: Define your pricing (get Price IDs from Stripe dashboard)
STRIPE_STARTER_PRICE_MONTHLY=price_...
STRIPE_STARTER_PRICE_YEARLY=price_...
STRIPE_PRO_PRICE_MONTHLY=price_...
STRIPE_PRO_PRICE_YEARLY=price_...
STRIPE_ENTERPRISE_PRICE_MONTHLY=price_...
STRIPE_ENTERPRISE_PRICE_YEARLY=price_...
```

## Step 4: Create Products and Pricing

In your Stripe Dashboard:

1. **Create Products**:
   - Go to **Products** → **Add product**
   - Create three products: "Starter", "Pro", "Enterprise"
   - Add descriptions for each tier

2. **Create Pricing**:
   - For each product, create TWO prices:
     - Monthly (recurring, billing period: 1 month)
     - Yearly (recurring, billing period: 1 year)
   - Copy the Price IDs and add them to `.env`

Example Price IDs:
- Starter Monthly: `price_1P9k4kL8ZxH8P2...`
- Starter Yearly: `price_1P9k4kL8ZxH8P2...`
- (repeat for Pro and Enterprise)

## Step 5: Set Up Webhooks

Webhooks allow Stripe to notify your application of payment events.

### Configure Webhook Endpoint:

1. **In Stripe Dashboard**:
   - Go to **Developers** → **Webhooks**
   - Click **Add endpoint**
   - Enter your endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
   - Select events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.created`
     - `invoice.updated`
     - `invoice.finalized`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

2. **After creating webhook**:
   - Copy the **Signing Secret** (starts with `whsec_`)
   - Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`

### Local Testing with Stripe CLI:

For development, use the Stripe CLI to test webhooks locally:

```bash
# Install Stripe CLI (follow instructions at https://stripe.com/docs/stripe-cli)

# Authenticate
stripe login

# Forward webhook events to your local app
stripe listen --forward-to localhost:5173/api/webhooks/stripe

# In another terminal, trigger test events
stripe trigger payment_intent.succeeded
```

## Step 6: Database Setup

The application tracks all Stripe events in the database:

```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Seed demo data (includes subscription plans)
npm run db:seed
```

### Database Tables:
- `stripe_customers` - Stripe customer records
- `stripe_subscriptions` - Subscription details
- `stripe_payments` - Payment transaction history
- `stripe_invoices` - Invoice records
- `subscription_plans` - Your pricing tiers

## Step 7: Test Payment Flow

### Test Cards:
Use these test card numbers in Test Mode:

- **Success**: `4242 4242 4242 4242`
- **Requires Authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`

### Run Test:
```bash
npm run dev

# Visit: http://localhost:5173/billing
# Click "Upgrade" to test checkout flow
```

## Step 8: Configure Billing Portal

The billing portal allows customers to manage their subscriptions.

### In Stripe Dashboard:
1. **Settings** → **Billing Portal**
2. **Create session** to test, or use app URLs:
   - Success URL: `https://yourdomain.com/dashboard`
   - Cancel URL: `https://yourdomain.com/billing`

### Your App Implementation:
The app automatically handles billing portal sessions. See:
- `lib/stripe/index.ts` - `createBillingPortalSession()`
- Routes that call this function

## Step 9: Enable Stripe Terminal (POS)

For point-of-sale payments:

1. **In Stripe Dashboard**:
   - **Products** → **Readers**
   - Purchase physical readers or use simulated readers for testing

2. **In Your App**:
   - Implement Terminal location setup
   - Register readers with `registerTerminalReader()`
   - See `lib/integrations/stripe.server.ts` for Terminal functions

## Step 10: Go Live

When ready for production:

1. **In Stripe Dashboard**:
   - Complete your account review
   - Enable Live Mode in account settings
   - Generate live mode API keys

2. **In Your App**:
   - Update `.env` with live API keys
   - Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
   - Deploy to production

3. **Switch Price IDs**:
   - Create live mode products and prices
   - Update `.env` with live price IDs

## Key Files Reference

### Core Stripe Logic:
- `lib/stripe/index.ts` - Main Stripe client and subscription functions
- `lib/stripe/stripe-billing.server.ts` - Billing functions and database sync
- `lib/stripe/webhook.server.ts` - Webhook event handling
- `lib/stripe/email-notifications.server.ts` - Payment confirmation emails

### Integration Functions:
- `lib/integrations/stripe.server.ts` - Org-level Stripe integration (for multi-user teams)
- `lib/db/schema/stripe.ts` - Database schema for Stripe tables

### Routes:
- API routes handle webhook processing
- Dashboard pages call Stripe functions for subscriptions and billing portal

## Common Tasks

### Create a Checkout Session:
```typescript
import { createCheckoutSession } from '@/lib/stripe/index';

const checkoutUrl = await createCheckoutSession(
  tenantId,
  'pro',           // plan: starter | pro | enterprise
  'monthly',       // billing period: monthly | yearly
  'https://yourdomain.com/success',
  'https://yourdomain.com/cancel'
);
```

### Get Subscription Status:
```typescript
import { getSubscriptionStatus } from '@/lib/stripe/index';

const status = await getSubscriptionStatus(tenantId);
// Returns: { status, currentPeriodEnd, cancelAtPeriodEnd }
```

### Cancel a Subscription:
```typescript
import { cancelSubscription } from '@/lib/stripe/index';

await cancelSubscription(tenantId);
```

### Retrieve Payment Method:
```typescript
import { getPaymentMethod } from '@/lib/stripe/index';

const paymentMethod = await getPaymentMethod(tenantId);
// Returns: { type, brand, last4, expiryMonth, expiryYear }
```

## Troubleshooting

### "STRIPE_SECRET_KEY not set"
- Check your `.env` file has `STRIPE_SECRET_KEY=sk_test_...`
- Restart dev server after changing `.env`
- Don't commit real keys to git

### Webhook not triggering
- Verify endpoint URL is publicly accessible
- Check webhook signing secret matches `STRIPE_WEBHOOK_SECRET`
- Use Stripe CLI: `stripe listen --forward-to localhost:5173/api/webhooks/stripe`
- Check request logs for 400+ errors

### Payment fails with "Price not found"
- Verify price IDs in `.env` match Stripe dashboard
- Ensure prices are in the correct currency and mode (test/live)
- Check that the price exists in the selected product

### Subscription not created
- Verify customer has valid email in Stripe
- Check database has subscription plans with matching names
- Look at webhook logs in Stripe dashboard

## Security Best Practices

1. ✅ **Never commit API keys** - Use `.env` file, add to `.gitignore`
2. ✅ **Always verify webhooks** - Stripe webhook verification is already implemented
3. ✅ **Use HTTPS** - Required for production webhook endpoints
4. ✅ **Rotate keys regularly** - Create new keys and update `.env`
5. ✅ **Restrict API permissions** - Use restricted API keys if possible
6. ✅ **Monitor Stripe dashboard** - Watch for unusual activity or disputes

## Next Steps

1. ✅ Create Stripe account
2. ✅ Get API keys and configure `.env`
3. ✅ Create products and prices
4. ✅ Set up webhooks
5. ✅ Run `npm run db:seed` to populate subscription plans
6. ✅ Test with local dev server
7. ✅ Deploy and go live

## Support & Resources

- **Stripe Documentation**: https://stripe.com/docs
- **API Reference**: https://stripe.com/docs/api
- **Testing Guide**: https://stripe.com/docs/testing
- **Webhooks Guide**: https://stripe.com/docs/webhooks
- **SDK Reference**: https://github.com/stripe/stripe-node
