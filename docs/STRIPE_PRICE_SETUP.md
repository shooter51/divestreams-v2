# Stripe Price Setup for Subscription Plans

## Problem

When trying to upgrade a subscription, you may see this error:

```
Subscription upgrade not available: The "pro" plan does not have a
Stripe Price ID configured for monthly billing. Please contact support
or try a different billing period.
```

**Root Cause**: The subscription plans in the database don't have `monthlyPriceId` and `yearlyPriceId` fields populated with Stripe price IDs.

## Solution: Automatic Setup Script

Run the provided script to automatically create Stripe products and prices, then update the database:

```bash
npx tsx scripts/setup-stripe-prices.ts
```

**What this script does:**
1. Fetches all subscription plans from your database
2. For each paid plan (Pro, Enterprise):
   - Creates a Stripe Product (e.g., "DiveStreams Pro Plan")
   - Creates a monthly Price (recurring interval: month)
   - Creates a yearly Price (recurring interval: year)
3. Updates the database with the generated price IDs
4. Skips plans that already have price IDs configured

**Example Output:**
```
🚀 Setting up Stripe prices for subscription plans...

Found 4 plans in database:

📦 Processing plan: Free (free)
  ⊘ Skipping free plan (no Stripe prices needed)

📦 Processing plan: Starter (starter)
  ✓ Created product: prod_ABC123
  ✓ Created monthly price: price_XYZ789 ($29.00/mo)
  ✓ Created yearly price: price_DEF456 ($290.00/yr)
  ✓ Updated plan in database with price IDs

📦 Processing plan: Pro (pro)
  ✓ Created product: prod_GHI789
  ✓ Created monthly price: price_JKL012 ($49.00/mo)
  ✓ Created yearly price: price_MNO345 ($470.00/yr)
  ✓ Updated plan in database with price IDs

✅ Stripe price setup complete!
```

## Manual Setup (Alternative)

If you prefer to set up prices manually:

### 1. Create Products and Prices in Stripe Dashboard

Visit: https://dashboard.stripe.com/products

For each paid plan (Starter, Pro, Enterprise):

1. **Create Product**:
   - Name: "DiveStreams Pro Plan"
   - Description: "DiveStreams Pro Plan"

2. **Add Monthly Price**:
   - Billing period: Monthly
   - Price: $49.00 (or your plan's monthly price)
   - Currency: USD
   - Copy the Price ID (starts with `price_`)

3. **Add Yearly Price**:
   - Billing period: Yearly
   - Price: $470.00 (or your plan's yearly price)
   - Currency: USD
   - Copy the Price ID (starts with `price_`)

### 2. Update Database

Option A: Via Admin UI
1. Navigate to `/admin/plans`
2. Edit each plan
3. Paste the Stripe Price IDs in the form fields
4. Save

Option B: Direct SQL Update
```sql
UPDATE subscription_plans
SET
  monthly_price_id = 'price_YOUR_MONTHLY_ID',
  yearly_price_id = 'price_YOUR_YEARLY_ID',
  updated_at = NOW()
WHERE name = 'pro';
```

## Verification

After setup, verify in Stripe Dashboard:

1. **Products**: https://dashboard.stripe.com/products
   - Should see products for each plan

2. **Prices**: Click into each product
   - Should see 2 prices: Monthly and Yearly
   - Check that amounts match your plan configuration

3. **Test the upgrade flow**:
   - Go to Settings → Billing
   - Click "Upgrade to Pro"
   - Should redirect to Stripe Checkout (no error)

## Environment-Specific Setup

### Development/Staging
- Use **Test Mode** Stripe keys
- Price IDs will start with `price_test_`
- No real charges will be made

### Production
- Use **Live Mode** Stripe keys
- Price IDs will start with `price_live_`
- Real charges will be processed

**Important**: You'll need to run the setup script separately for each environment (dev, staging, production) with the appropriate Stripe keys.

## Troubleshooting

**"STRIPE_SECRET_KEY not set" error**:
```bash
# Check .env file
cat .env | grep STRIPE_SECRET_KEY

# If missing, add it:
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env
```

**"StripeAuthenticationError"**:
- Verify your Stripe secret key is correct
- Check you're using the right key for your environment (test vs live)

**"Product already exists" error**:
- The script checks for existing price IDs before creating
- If you manually created products, you can skip re-running
- Or manually add the price IDs to the database

**Prices showing as $0.00**:
- Check the `monthlyPrice` and `yearlyPrice` in the `subscription_plans` table
- Values should be in cents (e.g., 4900 = $49.00)
- Update via admin UI at `/admin/plans`

## Related Files

- **Script**: `scripts/setup-stripe-prices.ts`
- **Stripe Integration**: `lib/stripe/index.ts` (lines 130-137)
- **Admin Plan Editor**: `app/routes/admin/plans.$id.tsx`
- **Database Schema**: `lib/db/schema.ts` (lines 77-78)

## See Also

- [Stripe Products & Prices Documentation](https://stripe.com/docs/products-prices/overview)
- [Stripe Checkout for Subscriptions](https://stripe.com/docs/billing/subscriptions/checkout)
