#!/usr/bin/env tsx
/**
 * Tenant Creation Script
 *
 * Usage:
 *   npm run tenant:create -- --subdomain=demo --name="Demo Dive Shop" --email=owner@demo.com
 *
 * Options:
 *   --subdomain  Required. The subdomain for the tenant (e.g., "demo" for demo.divestreams.com)
 *   --name       Required. The display name of the dive shop
 *   --email      Required. The owner's email address
 *   --phone      Optional. Phone number
 *   --timezone   Optional. Timezone (default: UTC)
 *   --currency   Optional. Currency code (default: USD)
 */

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { createTenant, isSubdomainAvailable } from "../lib/db/tenant.server";
import { db } from "../lib/db";
import { subscriptionPlans } from "../lib/db/schema";

async function main() {
  const { values } = parseArgs({
    options: {
      subdomain: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      timezone: { type: "string", default: "UTC" },
      currency: { type: "string", default: "USD" },
    },
  });

  // Validate required arguments
  if (!values.subdomain) {
    console.error("Error: --subdomain is required");
    process.exit(1);
  }

  if (!values.name) {
    console.error("Error: --name is required");
    process.exit(1);
  }

  if (!values.email) {
    console.error("Error: --email is required");
    process.exit(1);
  }

  // Validate subdomain format
  const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  if (!subdomainRegex.test(values.subdomain.toLowerCase())) {
    console.error("Error: Subdomain must contain only lowercase letters, numbers, and hyphens");
    console.error("       Cannot start or end with a hyphen");
    process.exit(1);
  }

  // Reserved subdomains
  const reserved = ["www", "api", "admin", "app", "mail", "smtp", "ftp", "blog", "help", "support", "status"];
  if (reserved.includes(values.subdomain.toLowerCase())) {
    console.error(`Error: "${values.subdomain}" is a reserved subdomain`);
    process.exit(1);
  }

  console.log("\n🏊 DiveStreams Tenant Creation\n");
  console.log("Checking subdomain availability...");

  // Check if subdomain is available
  const available = await isSubdomainAvailable(values.subdomain);
  if (!available) {
    console.error(`Error: Subdomain "${values.subdomain}" is already taken`);
    process.exit(1);
  }

  console.log(`✓ Subdomain "${values.subdomain}" is available`);

  // Get the starter plan (or create it if it doesn't exist)
  let [starterPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, "starter"))
    .limit(1);

  if (!starterPlan) {
    console.log("Creating default subscription plans...");
    await seedSubscriptionPlans();
    [starterPlan] = await db.select().from(subscriptionPlans).limit(1);
  }

  console.log("Creating tenant...");

  try {
    const tenant = await createTenant({
      subdomain: values.subdomain,
      name: values.name,
      email: values.email,
      phone: values.phone,
      timezone: values.timezone,
      currency: values.currency,
      planId: starterPlan?.id,
    });

    console.log("\n✅ Tenant created successfully!\n");
    console.log("Details:");
    console.log(`  ID:         ${tenant.id}`);
    console.log(`  Subdomain:  ${tenant.subdomain}`);
    console.log(`  Name:       ${tenant.name}`);
    console.log(`  Email:      ${tenant.email}`);
    console.log(`  Schema:     ${tenant.schemaName}`);
    console.log(`  Status:     ${tenant.subscriptionStatus}`);
    console.log(`  Trial ends: ${tenant.trialEndsAt?.toISOString()}`);
    console.log(`\nAccess URL: http://${tenant.subdomain}.localhost:5173`);
    console.log("(In production: https://${tenant.subdomain}.divestreams.com)");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Failed to create tenant:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function seedSubscriptionPlans() {
  await db.insert(subscriptionPlans).values([
    {
      name: "starter",
      displayName: "Starter",
      monthlyPrice: 4900, // $49
      yearlyPrice: 47000, // $470 (2 months free)
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
      monthlyPrice: 9900, // $99
      yearlyPrice: 95000, // $950 (2 months free)
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
        customers: -1, // unlimited
        toursPerMonth: -1,
        storageGb: 25,
      },
    },
    {
      name: "enterprise",
      displayName: "Enterprise",
      monthlyPrice: 19900, // $199
      yearlyPrice: 191000, // $1,910 (2 months free)
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
}

main().catch(console.error);
