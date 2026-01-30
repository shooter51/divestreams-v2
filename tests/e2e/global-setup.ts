import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";
import { db } from "../../lib/db";
import { organization, user, member } from "../../lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { createTenant } from "../../lib/db/tenant.server";
import { auth } from "../../lib/auth";

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

    if (existingOrg) {
      console.log("✓ Demo organization already exists");
      return;
    }

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
    const [demoOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, "demo"))
      .limit(1);

    if (!demoOrg) {
      throw new Error("Failed to create demo organization");
    }

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

    // Add user as owner/member of demo organization
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: demoOrg.id,
      userId: userResult.user.id,
      email: "owner@demo.com",
      role: "owner",
      createdAt: new Date(),
    });

    console.log("✓ Demo organization created successfully");
    console.log("  - Organization: demo.localhost:5173");
    console.log("  - Email: owner@demo.com");
    console.log("  - Password: demo1234");
  } catch (error) {
    console.error("Failed to create demo organization:", error);
    // Don't fail the test run - tests will handle missing org gracefully
  }
}

export default globalSetup;
