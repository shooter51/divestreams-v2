# Stripe Integration Setup Guide

Complete guide for setting up Stripe payments and subscriptions in DiveStreams.

## Overview

DiveStreams uses Stripe for:
- **Subscription Management**: Recurring billing for Free, Professional, and Enterprise plans
- **Payment Processing**: One-time payments via POS integration
- **Invoice Management**: Automatic invoice generation and tracking
- **Customer Management**: Linking organizations to Stripe customers

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **API Keys**: Obtain from [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
3. **Webhook Secret**: Set up webhooks to receive real-time events

## Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys (use test keys for development)
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_... # Obtained from webhook setup
```

## Step 1: Create Subscription Products in Stripe

### Using Stripe Dashboard

1. Go to [Products](https://dashboard.stripe.com/products)
2. Click **+ Add Product**
3. Create the following products:

#### Professional Plan
- **Name**: Professional
- **Description**: Unlimited tours, up to 10 team members
- **Monthly Price**: $49.00
- **Yearly Price**: $470.00 (save 20%)
- **Price ID (Monthly)**: Save this as `price_professional_monthly`
- **Price ID (Yearly)**: Save this as `price_professional_yearly`

#### Enterprise Plan
- **Name**: Enterprise
- **Description**: Everything in Pro + unlimited team members
- **Monthly Price**: $99.00
- **Yearly Price**: $950.00 (save 20%)
- **Price ID (Monthly)**: Save this as `price_enterprise_monthly`
- **Price ID (Yearly)**: Save this as `price_enterprise_yearly`

### Update Database Plans

Add the Stripe Price IDs to your subscription plans in the database:

```sql
-- Update Professional plan
UPDATE subscription_plans
SET
  monthly_price_id = 'price_professional_monthly',
  yearly_price_id = 'price_professional_yearly'
WHERE name = 'professional';

-- Update Enterprise plan
UPDATE subscription_plans
SET
  monthly_price_id = 'price_enterprise_monthly',
  yearly_price_id = 'price_enterprise_yearly'
WHERE name = 'enterprise';
```

## Step 2: Configure Webhooks

Webhooks allow Stripe to notify your application about events in real-time.

### Local Development (using Stripe CLI)

1. **Install Stripe CLI**: [Download](https://stripe.com/docs/stripe-cli)

2. **Login to Stripe**:
```bash
stripe login
```

3. **Forward webhooks to local server**:
```bash
stripe listen --forward-to https://loopholetom.com/api/stripe-webhook
```

4. **Copy the webhook secret** from the output:
```
Your webhook signing secret is whsec_...
```

5. **Add to `.env`**:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production Setup

1. Go to [Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **+ Add Endpoint**
3. **Endpoint URL**: `https://yourdomain.com/api/stripe-webhook`
4. **Events to send**:
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
   - `payment_intent.canceled`
   - `checkout.session.completed`

5. **Copy the Signing Secret** and add to production environment variables

## Step 3: Run Database Migration

The Stripe integration includes comprehensive database tables for tracking:
- Stripe customers
- Subscriptions
- Payments
- Invoices

Run the migration:

```bash
npm run db:migrate
```

This creates the following tables:
- `stripe_customers` - Links organizations to Stripe customers
- `stripe_subscriptions` - Tracks all subscriptions (active and historical)
- `stripe_payments` - Payment transaction history
- `stripe_invoices` - Invoice records with PDF links

## Step 4: Test the Integration

### Test Cards

Use these test cards in development:

| Card Number | Scenario |
|------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Declined payment |
| `4000 0027 6000 3184` | Requires authentication (3D Secure) |

**Expiry**: Any future date
**CVC**: Any 3 digits
**ZIP**: Any 5 digits

### Test Subscription Flow

1. **Navigate to Billing Page**: `/app/settings/billing`
2. **Select a Plan**: Click "Upgrade" on Professional or Enterprise
3. **Complete Checkout**: Use test card `4242 4242 4242 4242`
4. **Verify Webhook**: Check logs for subscription creation events
5. **View Invoice History**: Invoices should appear on billing page

### Test Webhook Events

1. **Trigger test webhook**:
```bash
stripe trigger customer.subscription.created
```

2. **Check application logs** for webhook processing:
```bash
tail -f logs/application.log
```

3. **Verify database** - Check that records were created:
```sql
-- Check customer
SELECT * FROM stripe_customers WHERE organization_id = 'your_org_id';

-- Check subscription
SELECT * FROM stripe_subscriptions WHERE organization_id = 'your_org_id';

-- Check invoices
SELECT * FROM stripe_invoices WHERE organization_id = 'your_org_id';
```

## Step 5: Enable Customer Portal (Optional)

Stripe's Customer Portal allows users to manage their subscriptions and payment methods.

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/settings/billing/portal)
2. Enable the portal
3. Configure allowed features:
   - ✅ Update payment method
   - ✅ View invoices
   - ✅ Cancel subscription
   - ❌ Update subscription (handle via DiveStreams UI)

The billing page already integrates with the Customer Portal via the "Manage Payment" button.

## Architecture

### Subscription Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   User      │────▶│  Checkout    │────▶│   Stripe    │
│  Upgrades   │     │  Session     │     │  Processes  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Webhook    │
                                          │  Fires      │
                                          └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Database   │
                                          │  Updated    │
                                          └─────────────┘
```

### Database Tables

#### stripe_customers
Links DiveStreams organizations to Stripe customers (1:1 relationship).

#### stripe_subscriptions
Tracks all subscription states:
- Active subscriptions
- Trial subscriptions
- Canceled subscriptions
- Historical subscriptions

#### stripe_payments
Complete payment audit trail:
- Payment intents (succeeded/failed)
- Payment method details
- Receipt URLs

#### stripe_invoices
Invoice records with:
- Invoice PDFs
- Line items
- Payment status
- Billing periods

### Webhook Security

All webhooks are verified using Stripe's signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  payload,
  signature,
  webhookSecret
);
```

This ensures webhooks come from Stripe and haven't been tampered with.

## Troubleshooting

### Webhook signature verification failed

**Cause**: Incorrect `STRIPE_WEBHOOK_SECRET`

**Solution**:
1. Check webhook signing secret in Stripe Dashboard
2. Verify it matches your `.env` file
3. Restart the application

### Payment method not updating

**Cause**: Customer portal not configured

**Solution**:
1. Enable Customer Portal in Stripe Dashboard
2. Ensure webhook events are configured
3. Test with `stripe trigger checkout.session.completed`

### Invoices not appearing

**Cause**: Webhook events not firing

**Solution**:
1. Check webhook endpoint is accessible
2. Verify webhook events include `invoice.*`
3. Manually sync invoices:
```typescript
await fetchInvoicesFromStripe(orgId, 10);
```

### Subscription not syncing

**Cause**: Missing `organizationId` in metadata

**Solution**:
Ensure checkout session includes metadata:
```typescript
await stripe.checkout.sessions.create({
  // ...
  subscription_data: {
    metadata: {
      organizationId: orgId,
      planName: "Professional",
    },
  },
});
```

## Production Checklist

- [ ] Switch to live API keys (`sk_live_...`, `pk_live_...`)
- [ ] Configure production webhook endpoint
- [ ] Update subscription plans with live Price IDs
- [ ] Enable Customer Portal
- [ ] Test full subscription flow
- [ ] Set up Stripe email notifications
- [ ] Configure tax collection (if applicable)
- [ ] Review Stripe Dashboard for compliance settings
- [ ] Set up billing alerts for failed payments

## Security Best Practices

1. **Never expose secret keys**: Keep `STRIPE_SECRET_KEY` server-side only
2. **Verify webhooks**: Always use signature verification
3. **Use HTTPS**: Stripe requires HTTPS for webhooks
4. **Rotate keys**: Periodically rotate API keys
5. **Monitor logs**: Watch for suspicious webhook activity
6. **Limit permissions**: Use restricted API keys for specific operations

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe API Reference**: https://stripe.com/docs/api
- **Webhook Events**: https://stripe.com/docs/webhooks
- **Testing Guide**: https://stripe.com/docs/testing

## Additional Features

### Proration

Stripe automatically handles proration when users upgrade/downgrade mid-cycle.

### Trial Periods

Add trials by setting `trial_period_days` in subscription creation:

```typescript
subscription_data: {
  trial_period_days: 14,
}
```

### Coupons

Apply discount coupons during checkout:

```typescript
discounts: [{
  coupon: 'SUMMER20'
}]
```

### Metered Billing

For usage-based pricing, use Stripe's metered billing and report usage:

```typescript
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  { quantity: 100, timestamp: Date.now() / 1000 }
);
```
