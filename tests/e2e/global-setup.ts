import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";
import { db } from "../../lib/db";
import { organization, user, member } from "../../lib/db/schema/auth";
import { subscription, subscriptionPlans } from "../../lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createTenant } from "../../lib/db/tenant.server";
import { auth } from "../../lib/auth";
import { seedDemoData } from "../../lib/db/seed-demo-data.server";

async function globalSetup(config: FullConfig) {
  // Load .env file
  const envPath = path.join(process.cwd(), ".env");
  dotenv.config({ path: envPath });

  console.log("Environment variables loaded from .env");
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? "SET" : "NOT SET"}`);

  // Create demo organization for E2E tests if it doesn't exist
  try {
    console.log("\nChecking for demo organization...");

    const [existingOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, "demo"))
      .limit(1);

    let demoOrg = existingOrg;

    if (!existingOrg) {
      console.log("Creating demo organization for E2E tests...");

      // Create tenant and organization
      await createTenant({
        subdomain: "demo",
        name: "Demo Dive Shop",
        email: "owner@demo.com",
        phone: "+1-555-0100",
        timezone: "America/Los_Angeles",
        currency: "USD",
      });

      // Get the organization ID
      const [newDemoOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, "demo"))
        .limit(1);

      if (!newDemoOrg) {
        throw new Error("Failed to create demo organization");
      }

      demoOrg = newDemoOrg;
      console.log("✓ Demo organization created");
    } else {
      console.log("✓ Demo organization already exists");
    }

    // Always check if the demo user exists (even if org exists)
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, "owner@demo.com"))
      .limit(1);

    let demoUserId: string;

    if (!existingUser) {
      console.log("Creating demo owner user...");

      try {
        // Create owner user via Better Auth
        const userResult = await auth.api.signUpEmail({
          body: {
            email: "owner@demo.com",
            password: "demo1234",
            name: "Demo Owner",
          },
        });

        if (!userResult.user) {
          throw new Error("Failed to create demo owner user");
        }

        demoUserId = userResult.user.id;
        console.log("✓ Demo owner user created");
      } catch (error) {
        // Race condition: user may have been created by another worker between check and create
        console.log("User creation conflict detected, re-querying...");
        const [newUser] = await db
          .select()
          .from(user)
          .where(eq(user.email, "owner@demo.com"))
          .limit(1);

        if (!newUser) {
          throw new Error("Failed to create or find demo user after conflict");
        }
        demoUserId = newUser.id;
        console.log("✓ Demo owner user exists (created by parallel worker)");
      }
    } else {
      demoUserId = existingUser.id;
      console.log("✓ Demo owner user already exists");
    }

    // Always check if member relationship exists (regardless of user/org existence)
    const [existingMember] = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, demoUserId),
        eq(member.organizationId, demoOrg.id)
      ))
      .limit(1);

    if (!existingMember) {
      console.log("Creating member relationship for demo user...");
      try {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: demoOrg.id,
          userId: demoUserId,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log("✓ Demo member relationship created");
      } catch (error) {
        console.error("❌ Failed to create member relationship:", error);
        throw error; // Don't swallow this error - it's critical for tests
      }
    } else {
      console.log("✓ Demo member relationship already exists");
    }

    // Upgrade demo org to ENTERPRISE plan for full feature access in E2E tests
    // This ensures all features (POS, Training, Public Site, Equipment) are accessible
    // without hitting feature gate redirects during test execution
    console.log("Checking demo organization subscription plan...");

    const [enterprisePlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "enterprise"))
      .limit(1);

    if (!enterprisePlan) {
      throw new Error(
        "❌ SETUP FAILED: Enterprise subscription plan not found in database.\n" +
        "   This will cause 40+ E2E test failures due to feature gate restrictions.\n" +
        "   Fix: Run 'npm run db:seed' or 'tsx scripts/seed.ts' to populate subscription_plans table."
      );
    }

    await db
      .update(subscription)
      .set({
        plan: "enterprise",
        planId: enterprisePlan.id,
        status: "active",
      })
      .where(eq(subscription.organizationId, demoOrg.id));

    console.log("✓ Demo environment ready for E2E tests");
    console.log("  - Organization: demo.localhost:5173");
    console.log("  - Email: owner@demo.com");
    console.log("  - Password: demo1234");
    console.log("  - Plan: ENTERPRISE (all features enabled)");

    // Seed demo data (products, equipment, trips) for E2E tests
    console.log("\nSeeding demo tenant data (products, equipment, trips)...");
    try {
      // Call seedDemoData which will create products, equipment, and trips
      await seedDemoData(demoOrg.id);
      console.log("✓ Demo data seeded successfully");
    } catch (error) {
      console.warn("⚠️  Demo data seeding failed (will use minimal data):", error);
      // Insert minimal test data directly if seedDemoData fails
      // Use PUBLIC schema with organization_id (not tenant schemas)
      await db.execute(sql`
        INSERT INTO public.products (id, organization_id, name, description, category, price, cost_price, sku, stock_quantity, track_inventory, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${demoOrg.id}, 'Test Product 1', 'Test product for E2E', 'Test', 29.99, 15.00, 'TEST-001', 50, true, true, NOW(), NOW()),
          (gen_random_uuid(), ${demoOrg.id}, 'Test Product 2', 'Test product for E2E', 'Test', 39.99, 20.00, 'TEST-002', 50, true, true, NOW(), NOW()),
          (gen_random_uuid(), ${demoOrg.id}, 'Test Product 3', 'Test product for E2E', 'Test', 49.99, 25.00, 'TEST-003', 50, true, true, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
      console.log("✓ Minimal test data inserted");
    }

  } catch (error) {
    console.error("Failed to setup demo environment:", error);
    // Don't fail the test run - tests will handle missing org gracefully
  }
}

export default globalSetup;
