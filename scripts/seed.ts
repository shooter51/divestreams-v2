#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Seeds the public schema with:
 * - Subscription plans (from centralized config)
 *
 * Usage:
 *   npm run db:seed
 */

import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllPlanConfigs } from "../lib/stripe/plan-config";

async function main() {
  console.log("\n🌱 Seeding database from centralized config...\n");

  // Get all plan configurations
  const planConfigs = getAllPlanConfigs();

  for (const config of planConfigs) {
    // Check if plan exists
    const [existingPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, config.name))
      .limit(1);

    if (existingPlan) {
      // Update existing plan (prices may have changed)
      console.log(`Updating plan: ${config.displayName}`);
      await db
        .update(subscriptionPlans)
        .set({
          displayName: config.displayName,
          monthlyPrice: config.monthlyPrice,
          yearlyPrice: config.yearlyPrice,
          features: config.features,
          limits: config.limits,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.name, config.name));
      console.log(`  ✓ Updated ${config.displayName}: $${config.monthlyPrice/100}/mo`);
    } else {
      // Create new plan
      console.log(`Creating plan: ${config.displayName}`);
      await db.insert(subscriptionPlans).values({
        name: config.name,
        displayName: config.displayName,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        features: config.features,
        limits: config.limits,
      });
      console.log(`  ✓ Created ${config.displayName}: $${config.monthlyPrice/100}/mo`);
    }
  }

  console.log(`\n✅ Seeded ${planConfigs.length} subscription plans!\n`);
  console.log("📝 Next steps:");
  console.log("   1. Create Stripe prices: npm run stripe:setup");
  console.log("   2. Verify sync: npm run stripe:verify\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
