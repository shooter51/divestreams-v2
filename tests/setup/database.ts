import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as drizzleSql } from "drizzle-orm";
import { beforeAll, afterAll } from "vitest";

let container: StartedPostgreSqlContainer;
let testDb: ReturnType<typeof drizzle>;
let testSql: ReturnType<typeof postgres>;

export async function setupTestDatabase() {
  container = await new PostgreSqlContainer("postgres:15")
    .withDatabase("testdb")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = container.getConnectionUri();
  testSql = postgres(connectionString);
  testDb = drizzle(testSql);

  return { db: testDb, sql: testSql, connectionString };
}

export async function teardownTestDatabase() {
  if (testSql) {
    await testSql.end();
  }
  if (container) {
    await container.stop();
  }
}

export async function createTestTenantSchema(db: ReturnType<typeof drizzle>, schemaName: string) {
  await db.execute(drizzleSql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));

  // Create tenant tables (matching real schema from lib/db/schema.ts)
  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      date_of_birth DATE,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      medical_conditions TEXT,
      medications TEXT,
      certifications JSONB,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.dive_sites (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      max_depth DECIMAL(10,2),
      difficulty VARCHAR(50),
      description TEXT,
      gps_coordinates VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.boats (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      capacity INTEGER NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.tours (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      duration VARCHAR(100),
      price DECIMAL(10,2) NOT NULL,
      max_participants INTEGER,
      difficulty VARCHAR(50),
      includes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.trips (
      id SERIAL PRIMARY KEY,
      tour_id INTEGER REFERENCES ${schemaName}.tours(id),
      boat_id INTEGER REFERENCES ${schemaName}.boats(id),
      date DATE NOT NULL,
      time TIME NOT NULL,
      available_spots INTEGER,
      status VARCHAR(50) DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      booking_number TEXT UNIQUE NOT NULL,
      customer_id UUID REFERENCES ${schemaName}.customers(id) ON DELETE CASCADE,
      trip_id INTEGER REFERENCES ${schemaName}.trips(id) ON DELETE CASCADE,
      participants INTEGER NOT NULL,
      subtotal DECIMAL(10,2),
      discount DECIMAL(10,2),
      tax DECIMAL(10,2),
      total DECIMAL(10,2) NOT NULL,
      currency TEXT DEFAULT 'USD',
      special_requests TEXT,
      source TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      booking_id UUID REFERENCES ${schemaName}.bookings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency TEXT DEFAULT 'USD',
      method TEXT,
      stripe_payment_intent_id TEXT,
      stripe_charge_id TEXT,
      status TEXT DEFAULT 'pending',
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
}

export async function cleanupTestTenantSchema(db: ReturnType<typeof drizzle>, schemaName: string) {
  await db.execute(drizzleSql.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`));
}

export function useTestDatabase() {
  let dbSetup: Awaited<ReturnType<typeof setupTestDatabase>>;

  beforeAll(async () => {
    dbSetup = await setupTestDatabase();
  }, 60000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  return () => dbSetup;
}
