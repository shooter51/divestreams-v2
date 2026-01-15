#!/usr/bin/env tsx
/**
 * Setup Platform Admin Script
 *
 * Creates the initial platform admin for admin.divestreams.com
 *
 * Usage:
 *   npm run platform:setup -- --email=admin@divestreams.com --password=YourSecurePass123 --name="Platform Admin"
 *
 * This script:
 * 1. Creates a user via Better Auth signup API (handles password hashing)
 * 2. Creates the "platform" organization if needed
 * 3. Adds the user to the platform org as "owner"
 */

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { auth } from "../lib/auth/index.server";

const PLATFORM_ORG_SLUG = "platform";

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      name: { type: "string" },
    },
  });

  if (!values.email) {
    console.error("Error: --email is required");
    process.exit(1);
  }
  if (!values.password) {
    console.error("Error: --password is required");
    process.exit(1);
  }
  if (!values.name) {
    console.error("Error: --name is required");
    process.exit(1);
  }

  if (values.password.length < 8) {
    console.error("Error: Password must be at least 8 characters");
    process.exit(1);
  }

  console.log("\n🔐 Setting up Platform Admin\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable not set");
    process.exit(1);
  }

  const client = postgres(connectionString);
  let userId: string;

  try {
    // Step 1: Create user via Better Auth API
    console.log("1. Creating user account...");

    // Check if user already exists
    const existingUser = await client`
      SELECT id FROM "user" WHERE email = ${values.email}
    `;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`   ✓ User already exists (${userId})`);
    } else {
      // Use Better Auth's internal API to create user with proper password hashing
      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: values.email,
            password: values.password,
            name: values.name,
          },
        });

        if (result.user) {
          userId = result.user.id;
          console.log(`   ✓ Created user via Better Auth (${userId})`);
        } else {
          throw new Error("Failed to create user - no user returned");
        }
      } catch (signupError: unknown) {
        // User might already exist, try to find them
        const checkUser = await client`
          SELECT id FROM "user" WHERE email = ${values.email}
        `;
        if (checkUser.length > 0) {
          userId = checkUser[0].id;
          console.log(`   ✓ User exists (${userId})`);
        } else {
          throw signupError;
        }
      }
    }

    // Step 2: Check/Create platform organization
    console.log("2. Setting up platform organization...");
    const existingOrg = await client`
      SELECT id FROM organization WHERE slug = ${PLATFORM_ORG_SLUG}
    `;

    let orgId: string;
    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log(`   ✓ Platform organization exists (${orgId})`);
    } else {
      orgId = randomUUID();
      await client`
        INSERT INTO organization (id, name, slug, created_at)
        VALUES (${orgId}, 'DiveStreams Platform', ${PLATFORM_ORG_SLUG}, NOW())
      `;
      console.log(`   ✓ Created platform organization (${orgId})`);
    }

    // Step 3: Add user to platform organization as owner
    console.log("3. Adding user to platform organization...");
    const existingMember = await client`
      SELECT id FROM member
      WHERE user_id = ${userId} AND organization_id = ${orgId}
    `;

    if (existingMember.length > 0) {
      await client`
        UPDATE member SET role = 'owner'
        WHERE user_id = ${userId} AND organization_id = ${orgId}
      `;
      console.log(`   ✓ User is already a member, role set to owner`);
    } else {
      const memberId = randomUUID();
      await client`
        INSERT INTO member (id, user_id, organization_id, role, created_at)
        VALUES (${memberId}, ${userId}, ${orgId}, 'owner', NOW())
      `;
      console.log(`   ✓ Added user as platform owner`);
    }

    console.log("\n✅ Platform admin setup complete!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Login at: https://admin.divestreams.com/login");
    console.log("");
    console.log(`Email:    ${values.email}`);
    console.log(`Password: (as specified)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (error) {
    console.error("\n❌ Failed to setup platform admin:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

main().catch(console.error);
