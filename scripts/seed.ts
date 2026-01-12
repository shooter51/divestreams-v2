#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Seeds the public schema with:
 * - Subscription plans
 *
 * Usage:
 *   npm run db:seed
 */

import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("\n🌱 Seeding database...\n");

  // Check if plans already exist
  const existingPlans = await db.select().from(subscriptionPlans);
  if (existingPlans.length > 0) {
    console.log("Subscription plans already exist. Skipping...");
  } else {
    console.log("Creating subscription plans...");
    await db.insert(subscriptionPlans).values([
      {
        name: "starter",
        displayName: "Starter",
        monthlyPrice: 4900,
        yearlyPrice: 47000,
        features: [
          "Up to 3 users",
          "1,000 customers",
          "Booking management",
          "Basic reporting",
          "Email support",
        ],
        limits: {
          users: 3,
          customers: 1000,
          toursPerMonth: 100,
          storageGb: 5,
        },
      },
      {
        name: "pro",
        displayName: "Pro",
        monthlyPrice: 9900,
        yearlyPrice: 95000,
        features: [
          "Up to 10 users",
          "Unlimited customers",
          "Online booking widget",
          "Equipment tracking",
          "Advanced reporting",
          "Priority support",
          "API access",
        ],
        limits: {
          users: 10,
          customers: -1,
          toursPerMonth: -1,
          storageGb: 25,
        },
      },
      {
        name: "enterprise",
        displayName: "Enterprise",
        monthlyPrice: 19900,
        yearlyPrice: 191000,
        features: [
          "Unlimited users",
          "Unlimited customers",
          "Multi-location support",
          "Custom integrations",
          "Dedicated support",
          "White-label options",
          "SLA guarantee",
        ],
        limits: {
          users: -1,
          customers: -1,
          toursPerMonth: -1,
          storageGb: 100,
        },
      },
    ]);
    console.log("✓ Created 3 subscription plans");
  }

  console.log("\n✅ Seeding complete!\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
