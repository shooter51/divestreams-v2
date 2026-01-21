#!/usr/bin/env tsx
/**
 * Create Admin User Script
 *
 * Creates the platform organization and admin user for https://admin.divestreams.com
 *
 * Usage:
 *   npx tsx scripts/create-admin-user.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/create-admin-user.ts admin@divestreams.com DiveAdmin2024!
 */

import { db } from "../lib/db";
import { organization, member } from "../lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";

const PLATFORM_ORG_SLUG = "platform";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("❌ Error: Email and password are required");
    console.log("\nUsage:");
    console.log("  npx tsx scripts/create-admin-user.ts <email> <password>");
    console.log("\nExample:");
    console.log("  npx tsx scripts/create-admin-user.ts admin@divestreams.com DiveAdmin2024!");
    process.exit(1);
  }

  console.log("\n🔧 Creating admin user for platform...\n");

  try {
    // Step 1: Create or find platform organization
    console.log("1. Checking for platform organization...");
    let [platformOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, PLATFORM_ORG_SLUG))
      .limit(1);

    if (!platformOrg) {
      console.log("   Creating platform organization...");
      [platformOrg] = await db
        .insert(organization)
        .values({
          name: "DiveStreams Platform",
          slug: PLATFORM_ORG_SLUG,
          createdAt: new Date(),
        })
        .returning();
      console.log(`   ✅ Created organization: ${platformOrg.name} (${platformOrg.slug})`);
    } else {
      console.log(`   ✅ Platform organization exists: ${platformOrg.name}`);
    }

    // Step 2: Create user account using Better Auth
    console.log("\n2. Creating user account...");
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Platform Admin",
      },
    });

    if (!signUpResult || !signUpResult.user) {
      throw new Error("Failed to create user account");
    }

    const userId = signUpResult.user.id;
    console.log(`   ✅ Created user: ${email} (ID: ${userId})`);

    // Step 3: Add user as member of platform organization
    console.log("\n3. Adding user to platform organization...");
    const [membership] = await db
      .insert(member)
      .values({
        userId,
        organizationId: platformOrg.id,
        role: "admin",
        invitedAt: new Date(),
        createdAt: new Date(),
      })
      .returning();

    console.log(`   ✅ Added user as platform admin`);

    console.log("\n✅ SUCCESS! Admin user created.\n");
    console.log("Login credentials:");
    console.log(`   URL: https://admin.divestreams.com/login`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log();

  } catch (error) {
    console.error("\n❌ Error creating admin user:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
