/**
 * Sync Stripe Prices with Database
 *
 * Phase 1: Fix price sync issue (KAN-627)
 * Audits and syncs prices between database and Stripe.
 * Database is source of truth - Stripe prices are updated to match.
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-prices.ts
 */

import Stripe from "stripe";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";
import { eq, or } from "drizzle-orm";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable not set");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

interface PriceMismatch {
  planName: string;
  displayName: string;
  dbMonthly: number;
  stripeMonthly: number | null;
  dbYearly: number;
  stripeYearly: number | null;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
}

async function auditPrices(): Promise<PriceMismatch[]> {
  console.log("📊 Auditing prices...\n");

  const plans = await db.select().from(subscriptionPlans);
  const mismatches: PriceMismatch[] = [];

  for (const plan of plans) {
    if (plan.name === "free" || plan.monthlyPrice === 0) {
      console.log(`⊘ Skipping free plan: ${plan.displayName}`);
      continue;
    }

    console.log(`\n🔍 Checking plan: ${plan.displayName} (${plan.name})`);
    console.log(`   DB Monthly: $${plan.monthlyPrice / 100}`);
    console.log(`   DB Yearly: $${plan.yearlyPrice / 100}`);

    let stripeMonthly: number | null = null;
    let stripeYearly: number | null = null;

    // Fetch Stripe prices
    if (plan.monthlyPriceId) {
      try {
        const monthlyPrice = await stripe.prices.retrieve(plan.monthlyPriceId);
        stripeMonthly = monthlyPrice.unit_amount || 0;
        console.log(`   Stripe Monthly: $${stripeMonthly / 100} (${plan.monthlyPriceId})`);
      } catch (error) {
        console.error(`   ⚠️ Failed to fetch monthly price: ${plan.monthlyPriceId}`);
      }
    } else {
      console.log(`   ⚠️ No monthly price ID in database`);
    }

    if (plan.yearlyPriceId) {
      try {
        const yearlyPrice = await stripe.prices.retrieve(plan.yearlyPriceId);
        stripeYearly = yearlyPrice.unit_amount || 0;
        console.log(`   Stripe Yearly: $${stripeYearly / 100} (${plan.yearlyPriceId})`);
      } catch (error) {
        console.error(`   ⚠️ Failed to fetch yearly price: ${plan.yearlyPriceId}`);
      }
    } else {
      console.log(`   ⚠️ No yearly price ID in database`);
    }

    // Check for mismatches
    const monthlyMismatch = stripeMonthly !== null && stripeMonthly !== plan.monthlyPrice;
    const yearlyMismatch = stripeYearly !== null && stripeYearly !== plan.yearlyPrice;

    if (monthlyMismatch || yearlyMismatch || !plan.monthlyPriceId || !plan.yearlyPriceId) {
      mismatches.push({
        planName: plan.name,
        displayName: plan.displayName,
        dbMonthly: plan.monthlyPrice,
        stripeMonthly,
        dbYearly: plan.yearlyPrice,
        stripeYearly,
        monthlyPriceId: plan.monthlyPriceId,
        yearlyPriceId: plan.yearlyPriceId,
      });

      if (monthlyMismatch) {
        console.log(`   ❌ MISMATCH: Monthly price differs (DB: $${plan.monthlyPrice / 100}, Stripe: $${stripeMonthly! / 100})`);
      }
      if (yearlyMismatch) {
        console.log(`   ❌ MISMATCH: Yearly price differs (DB: $${plan.yearlyPrice / 100}, Stripe: $${stripeYearly! / 100})`);
      }
      if (!plan.monthlyPriceId) {
        console.log(`   ❌ MISSING: No monthly price ID`);
      }
      if (!plan.yearlyPriceId) {
        console.log(`   ❌ MISSING: No yearly price ID`);
      }
    } else {
      console.log(`   ✅ Prices match`);
    }
  }

  return mismatches;
}

async function syncPrices(mismatches: PriceMismatch[], dryRun: boolean = false) {
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`📝 ${dryRun ? "DRY RUN - No changes will be made" : "SYNCING PRICES"}`);
  console.log("=".repeat(60));

  if (mismatches.length === 0) {
    console.log("\n✅ No mismatches found! All prices are in sync.");
    return;
  }

  console.log(`\nFound ${mismatches.length} plan(s) with price issues:\n`);

  for (const mismatch of mismatches) {
    console.log(`\n🔧 Syncing plan: ${mismatch.displayName} (${mismatch.planName})`);

    try {
      // Get or create Stripe product
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, mismatch.planName))
        .limit(1);

      if (!plan) {
        console.error(`   ❌ Plan not found in database`);
        continue;
      }

      // Check metadata for existing product ID
      const metadata = plan.metadata as { stripeProductId?: string } | null;
      let productId = metadata?.stripeProductId;

      // If no product ID, search by plan name or create new
      if (!productId) {
        if (!dryRun) {
          console.log(`   Creating new Stripe product...`);
          const product = await stripe.products.create({
            name: mismatch.displayName,
            description: `DiveStreams ${mismatch.displayName} Plan`,
            metadata: {
              planId: plan.id,
              planName: plan.name,
            },
          });
          productId = product.id;
          console.log(`   ✓ Created product: ${productId}`);

          // Update database with product ID
          await db
            .update(subscriptionPlans)
            .set({
              metadata: { stripeProductId: productId },
              updatedAt: new Date(),
            })
            .where(eq(subscriptionPlans.id, plan.id));
        } else {
          console.log(`   [DRY RUN] Would create new Stripe product`);
        }
      }

      // Create new prices (Stripe prices are immutable, can't update them)
      let newMonthlyPriceId = mismatch.monthlyPriceId;
      let newYearlyPriceId = mismatch.yearlyPriceId;

      // Monthly price
      if (!mismatch.monthlyPriceId || mismatch.stripeMonthly !== mismatch.dbMonthly) {
        if (!dryRun && productId) {
          const monthlyPrice = await stripe.prices.create({
            product: productId,
            unit_amount: mismatch.dbMonthly,
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
          newMonthlyPriceId = monthlyPrice.id;
          console.log(`   ✓ Created monthly price: ${newMonthlyPriceId} ($${mismatch.dbMonthly / 100}/mo)`);
        } else {
          console.log(`   [DRY RUN] Would create monthly price: $${mismatch.dbMonthly / 100}/mo`);
        }
      }

      // Yearly price
      if (!mismatch.yearlyPriceId || mismatch.stripeYearly !== mismatch.dbYearly) {
        if (!dryRun && productId) {
          const yearlyPrice = await stripe.prices.create({
            product: productId,
            unit_amount: mismatch.dbYearly,
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
          newYearlyPriceId = yearlyPrice.id;
          console.log(`   ✓ Created yearly price: ${newYearlyPriceId} ($${mismatch.dbYearly / 100}/yr)`);
        } else {
          console.log(`   [DRY RUN] Would create yearly price: $${mismatch.dbYearly / 100}/yr`);
        }
      }

      // Update database with new price IDs
      if (!dryRun && (newMonthlyPriceId || newYearlyPriceId)) {
        await db
          .update(subscriptionPlans)
          .set({
            monthlyPriceId: newMonthlyPriceId,
            yearlyPriceId: newYearlyPriceId,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPlans.id, plan.id));
        console.log(`   ✓ Updated database with new price IDs`);
      } else if (dryRun) {
        console.log(`   [DRY RUN] Would update database with new price IDs`);
      }

    } catch (error: any) {
      console.error(`   ❌ Failed to sync plan:`, error.message);
    }
  }
}

async function main() {
  console.log("🚀 Stripe Price Sync Script (KAN-627)\n");
  console.log("Database is source of truth - Stripe will be updated to match.\n");

  const dryRun = process.argv.includes("--dry-run");

  // Phase 1: Audit
  const mismatches = await auditPrices();

  // Phase 2: Sync
  await syncPrices(mismatches, dryRun);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Price sync complete!");
  console.log("=".repeat(60) + "\n");

  if (dryRun) {
    console.log("This was a dry run. Run without --dry-run to apply changes.\n");
  } else {
    console.log("Next steps:");
    console.log("  1. Verify prices in Stripe Dashboard: https://dashboard.stripe.com/prices");
    console.log("  2. Test subscription upgrade flow in your app");
    console.log("  3. Check that correct prices are shown to users\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
