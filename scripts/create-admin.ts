#!/usr/bin/env tsx
/**
 * Create Admin User Script
 *
 * Usage:
 *   npm run admin:create -- --subdomain=demo --email=admin@demo.com --password=YourSecurePass123 --name="Admin User"
 */

import { parseArgs } from "node:util";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { getTenantBySubdomain, generateSchemaName } from "../lib/db/tenant.server";

// Hash password using scrypt (secure)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      subdomain: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      name: { type: "string" },
    },
  });

  if (!values.subdomain) {
    console.error("Error: --subdomain is required");
    process.exit(1);
  }
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

  console.log("\n🔐 Creating Admin User\n");

  // Check tenant exists
  const tenant = await getTenantBySubdomain(values.subdomain);
  if (!tenant) {
    console.error(`Error: Tenant "${values.subdomain}" not found`);
    process.exit(1);
  }

  console.log(`✓ Found tenant: ${tenant.name} (${tenant.subdomain})`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable not set");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const schemaName = tenant.schemaName;

  try {
    // First, add password_hash column if it doesn't exist
    await client.unsafe(`
      ALTER TABLE "${schemaName}".users
      ADD COLUMN IF NOT EXISTS password_hash TEXT
    `);
    console.log("✓ Password column ready");

    // Check if user already exists
    const existing = await client`
      SELECT id FROM "${client(schemaName)}".users WHERE email = ${values.email}
    `;

    const passwordHash = hashPassword(values.password);

    if (existing.length > 0) {
      // Update existing user
      await client`
        UPDATE "${client(schemaName)}".users
        SET password_hash = ${passwordHash},
            role = 'owner',
            is_active = true,
            name = ${values.name},
            updated_at = NOW()
        WHERE email = ${values.email}
      `;
      console.log(`✓ Updated existing user: ${values.email}`);
    } else {
      // Create new user
      await client`
        INSERT INTO "${client(schemaName)}".users (email, name, role, is_active, email_verified, password_hash)
        VALUES (${values.email}, ${values.name}, 'owner', true, true, ${passwordHash})
      `;
      console.log(`✓ Created new admin user: ${values.email}`);
    }

    console.log("\n✅ Admin user ready!\n");
    console.log("Login at:");
    console.log(`  https://${tenant.subdomain}.divestreams.com/auth/login`);
    console.log(`\nCredentials:`);
    console.log(`  Email: ${values.email}`);
    console.log(`  Password: (as specified)`);

  } catch (error) {
    console.error("\n❌ Failed to create admin:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

main().catch(console.error);
