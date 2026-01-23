/**
 * Multi-Tenant Database Operations Integration Tests
 *
 * Tests database operations with schema-per-tenant isolation,
 * ensuring data never crosses tenant boundaries.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../setup/database";

describe("Multi-Tenant Database Operations", () => {
  const getDb = useTestDatabase();
  const tenant1Schema = "tenant_test1";
  const tenant2Schema = "tenant_test2";

  beforeEach(async () => {
    const { db } = getDb();
    await createTestTenantSchema(db, tenant1Schema);
    await createTestTenantSchema(db, tenant2Schema);
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, tenant1Schema);
    await cleanupTestTenantSchema(db, tenant2Schema);
  });

  describe("Schema Switching", () => {
    it("should create separate schemas for different tenants", async () => {
      const { db } = getDb();

      // Verify both schemas exist
      const schemas = await db.execute(drizzleSql.raw(`
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('${tenant1Schema}', '${tenant2Schema}')
      `));

      expect(schemas.rows).toHaveLength(2);
    });

    it("should switch search path to target tenant schema", async () => {
      const { db } = getDb();

      // Set search path to tenant1
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));

      // Verify search path
      const result = await db.execute(drizzleSql.raw(`SHOW search_path`));
      expect(result.rows[0].search_path).toContain(tenant1Schema);
    });

    it("should isolate queries to correct tenant schema", async () => {
      const { db } = getDb();

      // Insert customer in tenant1
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Alice', 'Tenant1', 'alice@tenant1.com')
      `));

      // Insert customer in tenant2
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Bob', 'Tenant2', 'bob@tenant2.com')
      `));

      // Query tenant1 - should only see Alice
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
      const tenant1Customers = await db.execute(drizzleSql.raw(`
        SELECT * FROM customers
      `));
      expect(tenant1Customers.rows).toHaveLength(1);
      expect(tenant1Customers.rows[0].email).toBe("alice@tenant1.com");

      // Query tenant2 - should only see Bob
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
      const tenant2Customers = await db.execute(drizzleSql.raw(`
        SELECT * FROM customers
      `));
      expect(tenant2Customers.rows).toHaveLength(1);
      expect(tenant2Customers.rows[0].email).toBe("bob@tenant2.com");
    });
  });

  describe("Data Isolation", () => {
    it("should prevent cross-tenant data access", async () => {
      const { db } = getDb();

      // Create data in tenant1
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Charlie', 'Test', 'charlie@test.com')
      `));

      // Try to access from tenant2 - should find nothing
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
      const result = await db.execute(drizzleSql.raw(`
        SELECT * FROM customers WHERE email = 'charlie@test.com'
      `));

      expect(result.rows).toHaveLength(0);
    });

    it("should maintain separate auto-increment sequences per tenant", async () => {
      const { db } = getDb();

      // Insert in tenant1
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('User1', 'T1', 'user1@t1.com')
      `));

      const t1Result = await db.execute(drizzleSql.raw(`
        SELECT id FROM customers WHERE email = 'user1@t1.com'
      `));
      const t1Id = t1Result.rows[0].id;

      // Insert in tenant2
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('User1', 'T2', 'user1@t2.com')
      `));

      const t2Result = await db.execute(drizzleSql.raw(`
        SELECT id FROM customers WHERE email = 'user1@t2.com'
      `));
      const t2Id = t2Result.rows[0].id;

      // IDs should both be 1 (separate sequences)
      expect(t1Id).toBe(t2Id);
    });

    it("should handle concurrent operations across tenants", async () => {
      const { db } = getDb();

      // Simulate concurrent inserts
      const operations = [
        (async () => {
          await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
          for (let i = 0; i < 5; i++) {
            await db.execute(drizzleSql.raw(`
              INSERT INTO customers (first_name, last_name, email)
              VALUES ('User${i}', 'Tenant1', 'user${i}@t1.com')
            `));
          }
        })(),
        (async () => {
          await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
          for (let i = 0; i < 5; i++) {
            await db.execute(drizzleSql.raw(`
              INSERT INTO customers (first_name, last_name, email)
              VALUES ('User${i}', 'Tenant2', 'user${i}@t2.com')
            `));
          }
        })(),
      ];

      await Promise.all(operations);

      // Verify both tenants have 5 customers
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));
      const t1Count = await db.execute(drizzleSql.raw(`SELECT COUNT(*) FROM customers`));
      expect(parseInt(t1Count.rows[0].count)).toBe(5);

      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));
      const t2Count = await db.execute(drizzleSql.raw(`SELECT COUNT(*) FROM customers`));
      expect(parseInt(t2Count.rows[0].count)).toBe(5);
    });
  });

  describe("Foreign Key Constraints", () => {
    it("should enforce foreign keys within tenant schema", async () => {
      const { db } = getDb();
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));

      // Create tour
      await db.execute(drizzleSql.raw(`
        INSERT INTO tours (name, price, max_participants, is_active)
        VALUES ('Test Tour', 100.00, 10, true)
      `));

      const tour = await db.execute(drizzleSql.raw(`SELECT id FROM tours LIMIT 1`));
      const tourId = tour.rows[0].id;

      // Create boat
      await db.execute(drizzleSql.raw(`
        INSERT INTO boats (name, capacity, is_active)
        VALUES ('Test Boat', 20, true)
      `));

      const boat = await db.execute(drizzleSql.raw(`SELECT id FROM boats LIMIT 1`));
      const boatId = boat.rows[0].id;

      // Create trip with valid foreign keys
      await db.execute(drizzleSql.raw(`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `));

      const trips = await db.execute(drizzleSql.raw(`SELECT * FROM trips`));
      expect(trips.rows).toHaveLength(1);
    });

    it("should reject invalid foreign key references", async () => {
      const { db } = getDb();
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));

      // Try to create trip with non-existent tour_id
      await expect(
        db.execute(drizzleSql.raw(`
          INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
          VALUES (99999, 99999, '2024-12-25', '09:00:00', 10, 'scheduled')
        `))
      ).rejects.toThrow();
    });
  });

  describe("Cascading Deletes", () => {
    it("should cascade delete related records", async () => {
      const { db } = getDb();
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant1Schema}`));

      // Create customer
      await db.execute(drizzleSql.raw(`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Delete', 'Test', 'delete@test.com')
      `));

      const customer = await db.execute(drizzleSql.raw(`
        SELECT id FROM customers WHERE email = 'delete@test.com'
      `));
      const customerId = customer.rows[0].id;

      // Create tour and boat
      await db.execute(drizzleSql.raw(`
        INSERT INTO tours (name, price, max_participants, is_active)
        VALUES ('Test Tour', 100.00, 10, true)
      `));
      const tour = await db.execute(drizzleSql.raw(`SELECT id FROM tours LIMIT 1`));
      const tourId = tour.rows[0].id;

      await db.execute(drizzleSql.raw(`
        INSERT INTO boats (name, capacity, is_active)
        VALUES ('Test Boat', 20, true)
      `));
      const boat = await db.execute(drizzleSql.raw(`SELECT id FROM boats LIMIT 1`));
      const boatId = boat.rows[0].id;

      // Create trip
      await db.execute(drizzleSql.raw(`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `));
      const trip = await db.execute(drizzleSql.raw(`SELECT id FROM trips LIMIT 1`));
      const tripId = trip.rows[0].id;

      // Create booking
      await db.execute(drizzleSql.raw(`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK001', ${customerId}, ${tripId}, 2, 200.00, 'confirmed')
      `));

      // Verify booking exists
      let bookings = await db.execute(drizzleSql.raw(`SELECT * FROM bookings`));
      expect(bookings.rows).toHaveLength(1);

      // Delete trip - should cascade to bookings
      await db.execute(drizzleSql.raw(`DELETE FROM trips WHERE id = ${tripId}`));

      // Verify bookings were deleted
      bookings = await db.execute(drizzleSql.raw(`SELECT * FROM bookings`));
      expect(bookings.rows).toHaveLength(0);
    });
  });

  describe("Schema Migration", () => {
    it("should apply same schema structure to all tenant schemas", async () => {
      const { db } = getDb();

      // Check both schemas have same tables
      const getTables = async (schema: string) => {
        const result = await db.execute(drizzleSql.raw(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = '${schema}'
          ORDER BY table_name
        `));
        return result.rows.map((r) => r.table_name);
      };

      const tenant1Tables = await getTables(tenant1Schema);
      const tenant2Tables = await getTables(tenant2Schema);

      expect(tenant1Tables).toEqual(tenant2Tables);
      expect(tenant1Tables).toContain("customers");
      expect(tenant1Tables).toContain("bookings");
      expect(tenant1Tables).toContain("trips");
    });
  });
});
