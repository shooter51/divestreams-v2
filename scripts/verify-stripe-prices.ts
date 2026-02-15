#!/usr/bin/env tsx
/**
 * Verify Stripe Prices
 *
 * This script checks your Stripe account for existing prices and compares
 * them with your database configuration.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx tsx scripts/verify-stripe-prices.ts
 *   Or: npm run stripe:verify
 */

import Stripe from "stripe";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("❌ STRIPE_SECRET_KEY not set");
  console.error("\nUsage:");
  console.error("  STRIPE_SECRET_KEY=sk_test_xxx tsx scripts/verify-stripe-prices.ts");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);
const isTestMode = stripeSecretKey.startsWith("sk_test_");

async function main() {
  console.log(`\n🔍 Verifying Stripe prices (${isTestMode ? "TEST" : "LIVE"} mode)...\n`);

  // 1. Get all plans from database
  const plans = await db.select().from(subscriptionPlans);

  console.log(`📊 Found ${plans.length} plans in database:\n`);

  for (const plan of plans) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 Plan: ${plan.displayName} (${plan.name})`);
    console.log(`${"=".repeat(60)}\n`);

    console.log(`   Database Configuration:`);
    console.log(`   ├─ Monthly Price: $${(plan.monthlyPrice / 100).toFixed(2)}`);
    console.log(`   ├─ Yearly Price:  $${(plan.yearlyPrice / 100).toFixed(2)}`);
    console.log(`   ├─ Monthly Price ID: ${plan.monthlyPriceId || "❌ NOT SET"}`);
    console.log(`   └─ Yearly Price ID:  ${plan.yearlyPriceId || "❌ NOT SET"}\n`);

    // 2. Verify monthly price in Stripe (if set)
    if (plan.monthlyPriceId) {
      try {
        const price = await stripe.prices.retrieve(plan.monthlyPriceId);
        const priceMatch = price.unit_amount === plan.monthlyPrice;
        console.log(`   Stripe Monthly Price (${plan.monthlyPriceId}):`);
        console.log(`   ├─ Amount: $${((price.unit_amount || 0) / 100).toFixed(2)} ${priceMatch ? "✅" : "❌ MISMATCH"}`);
        console.log(`   ├─ Currency: ${price.currency.toUpperCase()}`);
        console.log(`   ├─ Interval: ${price.recurring?.interval || "N/A"}`);
        console.log(`   ├─ Active: ${price.active ? "✅ Yes" : "❌ No"}`);
        console.log(`   └─ Product: ${typeof price.product === "string" ? price.product : price.product?.id}\n`);

        if (!priceMatch) {
          console.log(`   ⚠️  WARNING: Database has $${(plan.monthlyPrice / 100).toFixed(2)} but Stripe has $${((price.unit_amount || 0) / 100).toFixed(2)}\n`);
        }
      } catch (error) {
        console.log(`   ❌ Error retrieving monthly price: ${(error as Error).message}\n`);
      }
    } else {
      console.log(`   ⚠️  Monthly price ID not configured\n`);
    }

    // 3. Verify yearly price in Stripe (if set)
    if (plan.yearlyPriceId) {
      try {
        const price = await stripe.prices.retrieve(plan.yearlyPriceId);
        const priceMatch = price.unit_amount === plan.yearlyPrice;
        console.log(`   Stripe Yearly Price (${plan.yearlyPriceId}):`);
        console.log(`   ├─ Amount: $${((price.unit_amount || 0) / 100).toFixed(2)} ${priceMatch ? "✅" : "❌ MISMATCH"}`);
        console.log(`   ├─ Currency: ${price.currency.toUpperCase()}`);
        console.log(`   ├─ Interval: ${price.recurring?.interval || "N/A"}`);
        console.log(`   ├─ Active: ${price.active ? "✅ Yes" : "❌ No"}`);
        console.log(`   └─ Product: ${typeof price.product === "string" ? price.product : price.product?.id}\n`);

        if (!priceMatch) {
          console.log(`   ⚠️  WARNING: Database has $${(plan.yearlyPrice / 100).toFixed(2)} but Stripe has $${((price.unit_amount || 0) / 100).toFixed(2)}\n`);
        }
      } catch (error) {
        console.log(`   ❌ Error retrieving yearly price: ${(error as Error).message}\n`);
      }
    } else {
      console.log(`   ⚠️  Yearly price ID not configured\n`);
    }
  }

  // 4. List all prices in Stripe account
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 All Prices in Stripe (${isTestMode ? "TEST" : "LIVE"} mode)`);
  console.log(`${"=".repeat(60)}\n`);

  const allPrices = await stripe.prices.list({ limit: 100 });
  console.log(`Found ${allPrices.data.length} prices:\n`);

  for (const price of allPrices.data) {
    const planName = price.metadata?.plan_name || "Unknown";
    const billingPeriod = price.metadata?.billing_period || price.recurring?.interval || "N/A";
    console.log(`   ${price.id}`);
    console.log(`   ├─ Amount: $${((price.unit_amount || 0) / 100).toFixed(2)}/${billingPeriod}`);
    console.log(`   ├─ Plan: ${planName}`);
    console.log(`   ├─ Active: ${price.active ? "✅" : "❌"}`);
    console.log(`   └─ Product: ${typeof price.product === "string" ? price.product : price.product?.id}\n`);
  }

  console.log("\n✅ Verification complete!\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
