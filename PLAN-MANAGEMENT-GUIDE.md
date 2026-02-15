# Subscription Plan Management Guide

## How Plans Work

DiveStreams uses **Admin UI** as the source of truth for subscription plans.

### Admin Interface

**Location:** `/admin/plans`

**Features:**
- ✅ Create/edit plans via UI
- ✅ Automatic Stripe product creation
- ✅ Automatic Stripe price creation/updates
- ✅ Price archiving when changed (Stripe prices are immutable)
- ✅ Database automatically updated

## Creating a New Plan

1. Navigate to `/admin/plans`
2. Click "Add Plan"
3. Fill in:
   - Internal name (lowercase, no spaces: `starter`, `pro`, `enterprise`)
   - Display name (shown to users)
   - Monthly price (USD)
   - Yearly price (USD)
   - Features (checkboxes + descriptions)
   - Limits (team members, customers, tours, storage)
4. Click "Create Plan"

**What happens automatically:**
- ✅ Stripe product created
- ✅ Monthly price created in Stripe
- ✅ Yearly price created in Stripe
- ✅ Database updated with Stripe price IDs
- ✅ Plan ready to use immediately

## Updating an Existing Plan

1. Navigate to `/admin/plans`
2. Click "Edit" on the plan
3. Change price or features
4. Click "Save Changes"

**What happens automatically:**
- ✅ New Stripe prices created (prices are immutable)
- ✅ Old Stripe prices archived (marked inactive)
- ✅ Database updated with new price IDs
- ✅ Existing subscriptions continue on old prices
- ✅ New subscriptions use new prices

## Important Notes

### Stripe Price Immutability

Stripe prices **cannot be changed** once created. When you update a price:

1. System creates NEW Stripe prices
2. Old prices are archived (inactive)
3. Existing customers keep their old price
4. New customers get the new price

This is intentional - existing subscribers aren't affected by price changes.

### Admin UI is Source of Truth

**DO:**
- ✅ Use admin UI to create/edit plans
- ✅ Trust automatic Stripe sync
- ✅ Check `/admin/plans` to see all active plans

**DON'T:**
- ❌ Edit `subscription_plans` table directly
- ❌ Create prices in Stripe dashboard manually
- ❌ Use the centralized config (`lib/stripe/plan-config.ts`) - it's for reference only

### Seed Script Role

The seed script (`npm run db:seed`) is only for:
- Initial setup on new databases
- Restoring default plans if deleted

**It does NOT:**
- Create Stripe prices
- Update existing plans
- Sync with Stripe

## Verifying Stripe Sync

After creating/updating a plan, verify in Stripe dashboard:

1. Go to https://dashboard.stripe.com/products
2. Find your product (named after display name)
3. Check that prices are created
4. Verify amounts match your input

## Troubleshooting

### "Failed to create Stripe prices"

**Cause:** STRIPE_SECRET_KEY not set or invalid

**Fix:**
1. Check `.env` has `STRIPE_SECRET_KEY=sk_test_...` (test) or `sk_live_...` (production)
2. Restart application
3. Try creating/updating plan again

### Plan shows but checkout fails

**Cause:** Missing Stripe price IDs

**Fix:**
1. Edit the plan in admin UI
2. Make any small change (e.g., add a space to description)
3. Save - this triggers Stripe price creation
4. Verify price IDs are populated

### Prices don't match between database and Stripe

**Cause:** Manual edits to database or Stripe

**Fix:**
1. Use admin UI as authoritative source
2. Edit plan in admin UI
3. Save - creates fresh Stripe prices

## Architecture

```
┌─────────────┐
│  Admin UI   │ (Source of Truth)
│ /admin/plans│
└──────┬──────┘
       │ Save Plan
       ▼
┌──────────────────────────┐
│ createStripeProduct...() │
│ - Creates Stripe Product │
│ - Creates Monthly Price  │
│ - Creates Yearly Price   │
└──────┬───────────────────┘
       │
       ▼
┌─────────────────┐      ┌─────────────────┐
│    Database     │      │  Stripe API     │
│ subscription_   │◄────►│  Products +     │
│    plans        │      │  Prices         │
└─────────────────┘      └─────────────────┘
```

## Best Practices

1. **Test in staging first** - Always create/update plans on staging before production
2. **Document changes** - Add notes in plan description about what changed
3. **Communicate** - Notify team before changing pricing
4. **Verify in Stripe** - Always check Stripe dashboard after changes
5. **Don't delete active plans** - Deactivate instead (prevents new signups, keeps existing)

## Migration Notes

If you're migrating from the old system:

1. **Existing plans** - Already have Stripe price IDs, no action needed
2. **New plans** - Use admin UI, Stripe sync is automatic
3. **Centralized config** - Ignore it, admin UI is the way

## FAQ

**Q: Can I change a plan's price without affecting existing subscribers?**
A: Yes! The system automatically creates new prices. Existing subscribers keep their old price.

**Q: How do I grandfather existing customers?**
A: Just update the price in admin UI. Old subscribers automatically stay on the old price.

**Q: What if I need to force existing customers to new pricing?**
A: You'll need to cancel and recreate their subscriptions (contact support or write custom migration).

**Q: Can I have different prices in test vs production?**
A: Yes. Use different STRIPE_SECRET_KEY values. Test mode = `sk_test_...`, Production = `sk_live_...`

---

**Summary:** Use `/admin/plans` to manage everything. Stripe sync is automatic. Don't edit database or Stripe directly.
