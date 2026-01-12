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

  // Create tenant tables
  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      emergency_contact VARCHAR(255),
      emergency_phone VARCHAR(50),
      certification_level VARCHAR(100),
      certification_agency VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
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
      id SERIAL PRIMARY KEY,
      booking_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES ${schemaName}.customers(id),
      trip_id INTEGER REFERENCES ${schemaName}.trips(id),
      participants INTEGER NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      paid_amount DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `));

  await db.execute(drizzleSql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.payments (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES ${schemaName}.bookings(id),
      amount DECIMAL(10,2) NOT NULL,
      method VARCHAR(50) NOT NULL,
      stripe_payment_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
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
