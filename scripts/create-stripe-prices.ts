#!/usr/bin/env tsx
/**
 * Create Stripe Prices for DiveStreams Plans
 *
 * This script creates Stripe products and prices using the centralized config.
 * Run this script to set up your Stripe pricing structure.
 *
 * Prerequisites:
 * - STRIPE_SECRET_KEY must be set in your .env file
 *
 * Usage:
 *   npm run stripe:setup
 */

import Stripe from "stripe";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { getPaidPlanConfigs } from "../lib/stripe/plan-config";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("❌ STRIPE_SECRET_KEY not set in environment");
  console.error("   Please add it to your .env file");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);
const isTestMode = stripeSecretKey.startsWith("sk_test_");

async function main() {
  console.log(`\n🔧 Setting up Stripe products and prices (${isTestMode ? "TEST" : "LIVE"} mode)...\n`);
  console.log("⚠️  Note: Stripe prices are immutable. This creates NEW prices.\n");

  // Get paid plans from centralized config
  const plans = getPaidPlanConfigs();

  for (const plan of plans) {
    console.log(`\n📦 Processing plan: ${plan.displayName}\n`);

    // 1. Create or get Stripe product
    console.log(`   Creating/updating Stripe product...`);
    const products = await stripe.products.list({
      limit: 100,
    });

    let product = products.data.find(
      (p) => p.metadata.plan_name === plan.name
    );

    if (product) {
      console.log(`   ✓ Found existing product: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: `DiveStreams ${plan.displayName}`,
        description: plan.description,
        metadata: {
          plan_name: plan.name,
        },
      });
      console.log(`   ✓ Created new product: ${product.id}`);
    }

    // 2. Create monthly price
    console.log(`   Creating monthly price ($${plan.monthlyPrice / 100})...`);
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: plan.monthlyPrice,
      recurring: {
        interval: "month",
      },
      metadata: {
        plan_name: plan.name,
        billing_period: "monthly",
      },
    });
    console.log(`   ✓ Created monthly price: ${monthlyPrice.id}`);

    // 3. Create yearly price
    console.log(`   Creating yearly price ($${plan.yearlyPrice / 100})...`);
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: plan.yearlyPrice,
      recurring: {
        interval: "year",
      },
      metadata: {
        plan_name: plan.name,
        billing_period: "yearly",
      },
    });
    console.log(`   ✓ Created yearly price: ${yearlyPrice.id}`);

    // 4. Update database with price IDs
    console.log(`   Updating database...`);
    await db
      .update(subscriptionPlans)
      .set({
        monthlyPriceId: monthlyPrice.id,
        yearlyPriceId: yearlyPrice.id,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.name, plan.name));
    console.log(`   ✓ Updated subscription_plans table`);

    console.log(`\n   📋 Summary for ${plan.displayName}:`);
    console.log(`      Product ID:   ${product.id}`);
    console.log(`      Monthly ID:   ${monthlyPrice.id}`);
    console.log(`      Yearly ID:    ${yearlyPrice.id}`);
    console.log(`      Monthly:      $${(plan.monthlyPrice / 100).toFixed(2)}/month`);
    console.log(`      Yearly:       $${(plan.yearlyPrice / 100).toFixed(2)}/year`);
  }

  console.log("\n✅ All Stripe prices created and database updated!\n");
  console.log("📝 Next steps:");
  console.log("   1. Verify sync: npm run stripe:verify");
  console.log("   2. View in Stripe Dashboard: https://dashboard.stripe.com/prices");
  console.log("   3. Test checkout flow in your application");
  console.log("   4. Set up Stripe webhook endpoint\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
