#!/usr/bin/env node
/**
 * Setup Platform Admin
 *
 * Creates the platform admin user and organization if they don't exist.
 * Triggered by PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD env vars.
 */

import postgres from 'postgres';
import crypto from 'crypto';
import { scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const PLATFORM_ORG_SLUG = 'platform';

// Hash password using scrypt (same as Better Auth)
// Better Auth uses: N=16384, r=16, p=1, dkLen=64
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    64,  // dkLen
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
  );
  return `${salt}:${key.toString('hex')}`;
}

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    console.log('PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_PASSWORD not set, skipping admin setup');
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const sql = postgres(connectionString);

  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM "user" WHERE email = ${email}
    `;

    let userId;

    const hashedPassword = await hashPassword(password);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`Platform admin already exists (${userId})`);

      // Check if credential account exists
      const existingAccount = await sql`
        SELECT id FROM account WHERE user_id = ${userId} AND provider_id = 'credential'
      `;

      if (existingAccount.length > 0) {
        // Update existing account password
        await sql`
          UPDATE account SET password = ${hashedPassword}, updated_at = NOW()
          WHERE user_id = ${userId} AND provider_id = 'credential'
        `;
        console.log('Updated password hash for existing admin');
      } else {
        // Create credential account for existing user
        const accountId = crypto.randomUUID();
        await sql`
          INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
          VALUES (${accountId}, ${userId}, ${userId}, 'credential', ${hashedPassword}, NOW(), NOW())
        `;
        console.log('Created credential account for existing user');
      }
    } else {
      // Create user
      userId = crypto.randomUUID();

      await sql`
        INSERT INTO "user" (id, email, email_verified, name, created_at, updated_at)
        VALUES (${userId}, ${email}, true, ${name}, NOW(), NOW())
      `;

      // Create account with password
      const accountId = crypto.randomUUID();
      await sql`
        INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
        VALUES (${accountId}, ${userId}, ${userId}, 'credential', ${hashedPassword}, NOW(), NOW())
      `;

      console.log(`Created platform admin user: ${email}`);
    }

    // Check/Create platform organization
    const existingOrg = await sql`
      SELECT id FROM organization WHERE slug = ${PLATFORM_ORG_SLUG}
    `;

    let orgId;
    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log(`Platform organization exists (${orgId})`);
    } else {
      orgId = crypto.randomUUID();
      await sql`
        INSERT INTO organization (id, name, slug, created_at, updated_at)
        VALUES (${orgId}, 'DiveStreams Platform', ${PLATFORM_ORG_SLUG}, NOW(), NOW())
      `;
      console.log(`Created platform organization (${orgId})`);
    }

    // Add user to platform organization as owner
    const existingMember = await sql`
      SELECT id FROM member
      WHERE user_id = ${userId} AND organization_id = ${orgId}
    `;

    if (existingMember.length > 0) {
      await sql`
        UPDATE member SET role = 'owner', updated_at = NOW()
        WHERE user_id = ${userId} AND organization_id = ${orgId}
      `;
      console.log('User already a member, role set to owner');
    } else {
      const memberId = crypto.randomUUID();
      await sql`
        INSERT INTO member (id, user_id, organization_id, role, created_at, updated_at)
        VALUES (${memberId}, ${userId}, ${orgId}, 'owner', NOW(), NOW())
      `;
      console.log('Added user as platform owner');
    }

    console.log('Platform admin setup complete!');

  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error('Admin setup failed:', err);
  // Don't exit with error - app should still start
});
