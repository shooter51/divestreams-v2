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
        name: "free",
        displayName: "Free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: [
          "1 user",
          "50 customers",
          "Basic booking management",
          "5 tours per month",
          "Community support",
        ],
        limits: {
          users: 1,
          customers: 50,
          toursPerMonth: 5,
          storageGb: 0.5,
        },
      },
      {
        name: "starter",
        displayName: "Starter",
        monthlyPrice: 4900,
        yearlyPrice: 47000,
        features: [
          "Up to 3 users",
          "500 customers",
          "Booking management",
          "Public booking site",
          "Basic reporting",
          "Email support",
        ],
        limits: {
          users: 3,
          customers: 500,
          toursPerMonth: 25,
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
          "5,000 customers",
          "Online booking widget",
          "Equipment & rental tracking",
          "Training management",
          "Point of Sale",
          "Advanced reporting",
          "Priority support",
          "API access",
        ],
        limits: {
          users: 10,
          customers: 5000,
          toursPerMonth: 100,
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
    console.log("✓ Created 4 subscription plans (free, starter, pro, enterprise)");
  }

  console.log("\n✅ Seeding complete!\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
