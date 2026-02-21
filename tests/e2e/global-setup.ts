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
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "../../lib/plan-features";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
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

        // Verify email for E2E tests
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, demoUserId));

        console.log("✓ Demo owner user created");
      } catch {
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

      // Ensure email is verified for existing users
      if (!existingUser.emailVerified) {
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, demoUserId));
      }

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
      // Ensure role is "owner" (createTenant may have set a default role)
      if (existingMember.role !== "owner") {
        console.log(`Updating demo member role from "${existingMember.role}" to "owner"...`);
        await db
          .update(member)
          .set({ role: "owner" })
          .where(eq(member.id, existingMember.id));
        console.log("✓ Demo member role updated to owner");
      } else {
        console.log("✓ Demo member relationship already exists (role: owner)");
      }
    }

    // Upgrade demo org to PRO plan for full feature access in E2E tests
    // This ensures all features (POS, Training, Public Site, Equipment) are accessible
    // without hitting feature gate redirects during test execution
    console.log("Checking demo organization subscription plan...");

    const [proPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "pro"))
      .limit(1);

    if (!proPlan) {
      throw new Error(
        "❌ SETUP FAILED: Pro subscription plan not found in database.\n" +
        "   This will cause 40+ E2E test failures due to feature gate restrictions.\n" +
        "   Fix: Run 'npm run db:seed' or 'tsx scripts/seed.ts' to populate subscription_plans table."
      );
    }

    // Fix pro plan features: DB may have legacy string[] format (marketing text)
    // but the app expects PlanFeaturesObject (boolean flags). Without this fix,
    // the app falls back to DEFAULT_PLAN_FEATURES.standard and shows all features as locked.
    const planFeatures = proPlan.features;
    if (Array.isArray(planFeatures) || !planFeatures || typeof planFeatures !== "object") {
      console.log("Fixing pro plan features format (legacy string[] → boolean flags)...");
      await db
        .update(subscriptionPlans)
        .set({
          features: DEFAULT_PLAN_FEATURES.pro,
          limits: DEFAULT_PLAN_LIMITS.pro,
        })
        .where(eq(subscriptionPlans.id, proPlan.id));
      console.log("✓ Pro plan features updated to boolean flags format");
    }

    // Also fix all other plans in case they have the same issue
    const allPlans = await db.select().from(subscriptionPlans);
    for (const plan of allPlans) {
      const planName = plan.name.toLowerCase();
      if (planName !== "pro" && DEFAULT_PLAN_FEATURES[planName]) {
        const pf = plan.features;
        if (Array.isArray(pf) || !pf || typeof pf !== "object") {
          console.log(`Fixing ${plan.name} plan features format...`);
          await db
            .update(subscriptionPlans)
            .set({
              features: DEFAULT_PLAN_FEATURES[planName],
              limits: DEFAULT_PLAN_LIMITS[planName],
            })
            .where(eq(subscriptionPlans.id, plan.id));
        }
      }
    }

    await db
      .update(subscription)
      .set({
        plan: "pro",
        planId: proPlan.id,
        status: "active",
      })
      .where(eq(subscription.organizationId, demoOrg.id));

    // Create dedicated E2E test user (separate from owner, with form-compliant password)
    // This matches the user created by bootstrap on remote environments via signup form
    const e2eTesterEmail = "e2e-tester@demo.com";
    const [existingTester] = await db
      .select()
      .from(user)
      .where(eq(user.email, e2eTesterEmail))
      .limit(1);

    if (!existingTester) {
      console.log("Creating E2E tester user...");
      try {
        const testerResult = await auth.api.signUpEmail({
          body: {
            email: e2eTesterEmail,
            password: "DemoPass1234",
            name: "E2E Test User",
          },
        });

        if (testerResult.user) {
          await db
            .update(user)
            .set({ emailVerified: true })
            .where(eq(user.id, testerResult.user.id));

          // Add as member of demo org
          await db.insert(member).values({
            id: crypto.randomUUID(),
            organizationId: demoOrg.id,
            userId: testerResult.user.id,
            role: "owner",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log("✓ E2E tester user created");
        }
      } catch {
        console.log("E2E tester user already exists or conflict — OK");
      }
    } else {
      // Ensure member relationship exists
      const [testerMember] = await db
        .select()
        .from(member)
        .where(and(
          eq(member.userId, existingTester.id),
          eq(member.organizationId, demoOrg.id)
        ))
        .limit(1);

      if (!testerMember) {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: demoOrg.id,
          userId: existingTester.id,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log("✓ E2E tester user already exists");
    }

    console.log("✓ Demo environment ready for E2E tests");
    console.log(`  - Organization: demo.${(process.env.BASE_URL || "http://localhost:5173").replace(/^https?:\/\//, "")}`);
    console.log("  - Owner: owner@demo.com / demo1234");
    console.log("  - E2E Tester: e2e-tester@demo.com / DemoPass1234");
    console.log("  - Plan: PRO (all features enabled)");

    // =====================================================
    // Create PLATFORM organization and admin for E2E tests
    // This is required for admin-password-reset tests
    // =====================================================
    console.log("\nChecking for platform organization...");

    const [existingPlatformOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, "platform"))
      .limit(1);

    let platformOrg = existingPlatformOrg;

    if (!existingPlatformOrg) {
      console.log("Creating platform organization for E2E tests...");
      const platformOrgId = crypto.randomUUID();
      await db.insert(organization).values({
        id: platformOrgId,
        name: "DiveStreams Platform",
        slug: "platform",
        logo: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const [newPlatformOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, "platform"))
        .limit(1);

      if (!newPlatformOrg) {
        throw new Error("Failed to create platform organization");
      }

      platformOrg = newPlatformOrg;
      console.log("✓ Platform organization created");
    } else {
      console.log("✓ Platform organization already exists");
    }

    // Create platform admin user
    const platformAdminEmail = "admin@divestreams.com";
    const platformAdminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";

    const [existingPlatformAdmin] = await db
      .select()
      .from(user)
      .where(eq(user.email, platformAdminEmail))
      .limit(1);

    let platformAdminUserId: string;

    if (!existingPlatformAdmin) {
      console.log("Creating platform admin user...");
      try {
        const adminResult = await auth.api.signUpEmail({
          body: {
            email: platformAdminEmail,
            password: platformAdminPassword,
            name: "Platform Admin",
          },
        });

        if (!adminResult.user) {
          throw new Error("Failed to create platform admin user");
        }

        platformAdminUserId = adminResult.user.id;

        // Verify email for E2E tests
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, platformAdminUserId));

        console.log("✓ Platform admin user created");
      } catch {
        // Race condition handling
        console.log("Admin user creation conflict detected, re-querying...");
        const [newAdmin] = await db
          .select()
          .from(user)
          .where(eq(user.email, platformAdminEmail))
          .limit(1);

        if (!newAdmin) {
          throw new Error("Failed to create or find platform admin after conflict");
        }
        platformAdminUserId = newAdmin.id;
        console.log("✓ Platform admin user exists (created by parallel worker)");
      }
    } else {
      platformAdminUserId = existingPlatformAdmin.id;

      // Ensure email is verified for existing users
      if (!existingPlatformAdmin.emailVerified) {
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, platformAdminUserId));
      }

      console.log("✓ Platform admin user already exists");
    }

    // Create platform admin member relationship
    const [existingPlatformMember] = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, platformAdminUserId),
        eq(member.organizationId, platformOrg.id)
      ))
      .limit(1);

    if (!existingPlatformMember) {
      console.log("Creating platform admin member relationship...");
      try {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: platformOrg.id,
          userId: platformAdminUserId,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log("✓ Platform admin member relationship created");
      } catch (error) {
        console.error("❌ Failed to create platform admin membership:", error);
        throw error;
      }
    } else {
      console.log("✓ Platform admin member relationship already exists");
    }

    console.log("✓ Platform admin environment ready for E2E tests");
    console.log(`  - Admin URL: admin.${(process.env.BASE_URL || "http://localhost:5173").replace(/^https?:\/\//, "")}`);
    console.log("  - Email: " + platformAdminEmail);
    console.log("  - Password: " + platformAdminPassword);

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

    // =====================================================
    // Create E2ETEST tenant for workflow tests
    // This allows workflow tests to run in parallel without
    // depending on 00-full-workflow.spec.ts Block A
    // =====================================================
    console.log("\nChecking for e2etest organization...");

    const [existingE2eOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, "e2etest"))
      .limit(1);

    let e2eOrg = existingE2eOrg;

    if (!existingE2eOrg) {
      console.log("Creating e2etest organization for workflow tests...");

      await createTenant({
        subdomain: "e2etest",
        name: "E2E Test Shop",
        email: "e2e@example.com",
        phone: "+1-555-0200",
        timezone: "America/Los_Angeles",
        currency: "USD",
      });

      const [newE2eOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, "e2etest"))
        .limit(1);

      if (!newE2eOrg) {
        throw new Error("Failed to create e2etest organization");
      }

      e2eOrg = newE2eOrg;
      console.log("✓ E2E test organization created");
    } else {
      console.log("✓ E2E test organization already exists");
    }

    // Create e2etest user
    const e2eUserEmail = "e2e-user@example.com";
    const e2eUserPassword = "TestPass123!";

    const [existingE2eUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, e2eUserEmail))
      .limit(1);

    let e2eUserId: string;

    if (!existingE2eUser) {
      console.log("Creating e2etest user...");
      try {
        const e2eUserResult = await auth.api.signUpEmail({
          body: {
            email: e2eUserEmail,
            password: e2eUserPassword,
            name: "E2E Test User",
          },
        });

        if (!e2eUserResult.user) {
          throw new Error("Failed to create e2etest user");
        }

        e2eUserId = e2eUserResult.user.id;

        // Verify email for E2E tests
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, e2eUserId));

        console.log("✓ E2E test user created");
      } catch {
        console.log("E2E user creation conflict detected, re-querying...");
        const [newUser] = await db
          .select()
          .from(user)
          .where(eq(user.email, e2eUserEmail))
          .limit(1);

        if (!newUser) {
          throw new Error("Failed to create or find e2etest user after conflict");
        }
        e2eUserId = newUser.id;
        console.log("✓ E2E test user exists (created by parallel worker)");
      }
    } else {
      e2eUserId = existingE2eUser.id;

      // Ensure email is verified
      if (!existingE2eUser.emailVerified) {
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, e2eUserId));
      }

      console.log("✓ E2E test user already exists");
    }

    // Create e2etest member relationship
    const [existingE2eMember] = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, e2eUserId),
        eq(member.organizationId, e2eOrg.id)
      ))
      .limit(1);

    if (!existingE2eMember) {
      console.log("Creating e2etest member relationship...");
      try {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: e2eOrg.id,
          userId: e2eUserId,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log("✓ E2E test member relationship created");
      } catch (error) {
        console.error("❌ Failed to create e2etest member relationship:", error);
        throw error;
      }
    } else {
      // Ensure role is "owner" (createTenant may have set it to a default role)
      if (existingE2eMember.role !== "owner") {
        console.log(`Updating e2etest member role from "${existingE2eMember.role}" to "owner"...`);
        await db
          .update(member)
          .set({ role: "owner" })
          .where(eq(member.id, existingE2eMember.id));
        console.log("✓ E2E test member role updated to owner");
      } else {
        console.log("✓ E2E test member relationship already exists (role: owner)");
      }
    }

    // Upgrade e2etest org to PRO plan for full feature access
    if (proPlan) {
      // Check if subscription exists
      const [existingSub] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, e2eOrg.id))
        .limit(1);

      if (existingSub) {
        await db
          .update(subscription)
          .set({
            plan: "pro",
            planId: proPlan.id,
            status: "active",
          })
          .where(eq(subscription.organizationId, e2eOrg.id));
      } else {
        await db.insert(subscription).values({
          organizationId: e2eOrg.id,
          plan: "pro",
          planId: proPlan.id,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log("✓ E2E test organization upgraded to PRO plan");
    } else {
      console.warn("⚠️  Pro plan not found - e2etest org will use default plan");
    }

    // Seed training agencies for e2etest org
    console.log("Seeding training agencies for e2etest...");
    try {
      await seedDemoData(e2eOrg.id);
      console.log("✓ E2E test data seeded");
    } catch (error) {
      console.warn("⚠️  E2E test data seeding failed (tests will seed on demand):", error);
    }

    console.log("\n✓ E2E test environment ready for workflow tests");
    console.log(`  - Organization: e2etest.${(process.env.BASE_URL || "http://localhost:5173").replace(/^https?:\/\//, "")}`);
    console.log("  - Email: " + e2eUserEmail);
    console.log("  - Password: " + e2eUserPassword);
    console.log("  - Plan: PRO (all features enabled)");

  } catch (error) {
    console.error("Global setup failed:", error);
    throw error; // Fail fast instead of silently swallowing
  }
}

export default globalSetup;
