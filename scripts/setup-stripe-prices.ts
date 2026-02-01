/**
 * Setup Stripe Prices for Subscription Plans
 *
 * This script creates Stripe products and prices for each subscription plan,
 * then updates the database with the price IDs.
 *
 * Usage:
 *   npx tsx scripts/setup-stripe-prices.ts
 */

import Stripe from "stripe";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable not set");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

async function main() {
  console.log("🚀 Setting up Stripe prices for subscription plans...\n");

  // Fetch all plans from database
  const plans = await db.select().from(subscriptionPlans);

  console.log(`Found ${plans.length} plans in database:\n`);

  for (const plan of plans) {
    console.log(`\n📦 Processing plan: ${plan.displayName} (${plan.name})`);

    // Skip if already has price IDs
    if (plan.monthlyPriceId && plan.yearlyPriceId) {
      console.log(`  ✓ Already configured:`);
      console.log(`    Monthly: ${plan.monthlyPriceId}`);
      console.log(`    Yearly: ${plan.yearlyPriceId}`);
      continue;
    }

    // Skip free plan
    if (plan.name === "free" || plan.monthlyPrice === 0) {
      console.log(`  ⊘ Skipping free plan (no Stripe prices needed)`);
      continue;
    }

    try {
      // Create Stripe product
      const product = await stripe.products.create({
        name: plan.displayName,
        description: `DiveStreams ${plan.displayName} Plan`,
        metadata: {
          planId: plan.id,
          planName: plan.name,
        },
      });

      console.log(`  ✓ Created product: ${product.id}`);

      // Create monthly price
      let monthlyPriceId = plan.monthlyPriceId;
      if (!monthlyPriceId && plan.monthlyPrice > 0) {
        const monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.monthlyPrice,
          currency: "usd",
          recurring: {
            interval: "month",
          },
          metadata: {
            planId: plan.id,
            planName: plan.name,
            billingPeriod: "monthly",
          },
        });
        monthlyPriceId = monthlyPrice.id;
        console.log(`  ✓ Created monthly price: ${monthlyPriceId} ($${plan.monthlyPrice / 100}/mo)`);
      }

      // Create yearly price
      let yearlyPriceId = plan.yearlyPriceId;
      if (!yearlyPriceId && plan.yearlyPrice > 0) {
        const yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.yearlyPrice,
          currency: "usd",
          recurring: {
            interval: "year",
          },
          metadata: {
            planId: plan.id,
            planName: plan.name,
            billingPeriod: "yearly",
          },
        });
        yearlyPriceId = yearlyPrice.id;
        console.log(`  ✓ Created yearly price: ${yearlyPriceId} ($${plan.yearlyPrice / 100}/yr)`);
      }

      // Update plan with price IDs
      if (monthlyPriceId || yearlyPriceId) {
        await db
          .update(subscriptionPlans)
          .set({
            monthlyPriceId,
            yearlyPriceId,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPlans.id, plan.id));

        console.log(`  ✓ Updated plan in database with price IDs`);
      }

    } catch (error: any) {
      console.error(`  ❌ Failed to setup plan:`, error.message);
      if (error.type === "StripeAuthenticationError") {
        console.error(`     Check that STRIPE_SECRET_KEY is valid`);
      }
    }
  }

  console.log(`\n✅ Stripe price setup complete!\n`);
  console.log(`Next steps:`);
  console.log(`  1. Verify prices in Stripe Dashboard: https://dashboard.stripe.com/prices`);
  console.log(`  2. Test subscription upgrade flow in your app`);
  console.log(`  3. For production: repeat this script with production Stripe keys\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
