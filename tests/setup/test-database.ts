/**
 * Test Database Setup
 *
 * Provides utilities for setting up and tearing down test databases.
 * Uses in-memory SQLite for fast, isolated tests.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../lib/db/schema';

// Store the test database instance
let testDb: ReturnType<typeof drizzle> | null = null;
let sqliteDb: Database.Database | null = null;

/**
 * Set up a fresh test database
 */
export async function setupTestDatabase(): Promise<typeof testDb> {
  // Create in-memory SQLite database
  sqliteDb = new Database(':memory:');

  // Create drizzle instance with schema
  testDb = drizzle(sqliteDb, { schema });

  // Run migrations or create tables directly
  await createTestTables(sqliteDb);

  return testDb;
}

/**
 * Tear down the test database
 */
export async function teardownTestDatabase(): Promise<void> {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  testDb = null;
}

/**
 * Get the current test database instance
 */
export function getTestDb(): typeof testDb {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Clear all data from the test database
 */
export async function clearTestData(): Promise<void> {
  if (!sqliteDb) return;

  const tables = [
    'integrations',
    'integration_settings',
    'organization',
    'user',
  ];

  for (const table of tables) {
    try {
      sqliteDb.exec(`DELETE FROM ${table}`);
    } catch (e) {
      // Table might not exist, ignore
    }
  }
}

/**
 * Create test tables (simplified schema for integration tests)
 */
async function createTestTables(db: Database.Database): Promise<void> {
  // Organization table
  db.exec(`
    CREATE TABLE IF NOT EXISTS organization (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      subdomain TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      organization_id TEXT REFERENCES organization(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Integrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      account_id TEXT,
      account_name TEXT,
      account_email TEXT,
      scopes TEXT,
      last_synced_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, provider)
    )
  `);

  // Integration settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, provider)
    )
  `);

  // Trips table (for Google Calendar sync)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      location TEXT,
      calendar_event_id TEXT,
      calendar_sync_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Insert test data
 */
export async function insertTestOrganization(data: {
  id: string;
  name: string;
  slug: string;
}): Promise<void> {
  if (!sqliteDb) throw new Error('Database not initialized');

  sqliteDb.prepare(`
    INSERT INTO organization (id, name, slug)
    VALUES (?, ?, ?)
  `).run(data.id, data.name, data.slug);
}

export async function insertTestIntegration(data: {
  id: string;
  organizationId: string;
  provider: string;
  isActive?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
}): Promise<void> {
  if (!sqliteDb) throw new Error('Database not initialized');

  sqliteDb.prepare(`
    INSERT INTO integrations (
      id, organization_id, provider, is_active,
      access_token, refresh_token, expires_at,
      account_id, account_name, account_email
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.organizationId,
    data.provider,
    data.isActive ? 1 : 0,
    data.accessToken || null,
    data.refreshToken || null,
    data.expiresAt?.toISOString() || null,
    data.accountId || null,
    data.accountName || null,
    data.accountEmail || null
  );
}

export async function insertTestTrip(data: {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate?: string;
  location?: string;
}): Promise<void> {
  if (!sqliteDb) throw new Error('Database not initialized');

  sqliteDb.prepare(`
    INSERT INTO trips (id, organization_id, name, start_date, end_date, location)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.organizationId,
    data.name,
    data.startDate,
    data.endDate || null,
    data.location || null
  );
}
