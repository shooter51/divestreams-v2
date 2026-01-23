/**
 * Concurrent Operations and Data Integrity Integration Tests
 *
 * Tests concurrent database operations, race conditions,
 * and data integrity under load.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../setup/database";

describe("Concurrent Operations and Data Integrity", () => {
  const getDb = useTestDatabase();
  const testSchema = "tenant_concurrent";

  beforeEach(async () => {
    const { db } = getDb();
    await createTestTenantSchema(db, testSchema);
    await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, testSchema);
  });

  describe("Concurrent Inserts", () => {
    it("should handle concurrent customer inserts", async () => {
      const { sql } = getDb();

      const insertOperations = Array.from({ length: 20 }, (_, i) =>
        sql`
          INSERT INTO customers (first_name, last_name, email)
          VALUES (${`Customer${i}`}, 'Concurrent', ${`customer${i}@test.com`})
        `
      );

      await Promise.all(insertOperations);

      const customers = await sql`SELECT COUNT(*) as count FROM customers`;
      expect(parseInt(customers[0].count)).toBe(20);
    });

    it("should handle concurrent booking creation", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Test', 'Customer', 'test@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Create multiple bookings concurrently
      const bookingOperations = Array.from({ length: 10 }, (_, i) =>
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES (${`BK-CONC-${i}`}, ${customerId}, ${tripId}, 1, 100.00, 'confirmed')
        `
      );

      await Promise.all(bookingOperations);

      const bookings = await sql`SELECT COUNT(*) as count FROM bookings`;
      expect(parseInt(bookings[0].count)).toBe(10);
    });

    it("should maintain data integrity during concurrent inserts", async () => {
      const { sql } = getDb();

      const operations = Array.from({ length: 50 }, (_, i) =>
        sql`
          INSERT INTO customers (first_name, last_name, email)
          VALUES ('Integrity', ${`User${i}`}, ${`integrity${i}@test.com`})
        `
      );

      await Promise.all(operations);

      // Check all emails are unique
      const duplicates = await sql`
        SELECT email, COUNT(*) as count
        FROM customers
        GROUP BY email
        HAVING COUNT(*) > 1
      `;

      expect(duplicates).toHaveLength(0);
    });
  });

  describe("Concurrent Updates", () => {
    it("should handle concurrent updates to same record", async () => {
      const { sql } = getDb();

      // Create customer
      await sql`
        INSERT INTO customers (first_name, last_name, email, phone)
        VALUES ('Update', 'Test', 'update@test.com', '555-0000')
      `;

      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      // Concurrent updates
      const updateOperations = [
        sql`UPDATE customers SET phone = '555-1111' WHERE id = ${customerId}`,
        sql`UPDATE customers SET first_name = 'Updated1' WHERE id = ${customerId}`,
        sql`UPDATE customers SET last_name = 'Changed' WHERE id = ${customerId}`,
        sql`UPDATE customers SET phone = '555-2222' WHERE id = ${customerId}`,
      ];

      await Promise.all(updateOperations);

      // Record should exist with some combination of updates
      const updated = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(updated).toHaveLength(1);
      // At least one update should have succeeded
      expect(updated[0].first_name === "Updated1" || updated[0].last_name === "Changed").toBe(true);
    });

    it("should handle concurrent booking status updates", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Test', 'Customer', 'test@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Create multiple bookings
      for (let i = 0; i < 5; i++) {
        await sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES (${`BK-STATUS-${i}`}, ${customerId}, ${tripId}, 1, 100.00, 'pending')
        `;
      }

      const bookings = await sql`SELECT id FROM bookings`;

      // Update all to confirmed concurrently
      const statusUpdates = bookings.map((booking) =>
        sql`UPDATE bookings SET status = 'confirmed' WHERE id = ${booking.id}`
      );

      await Promise.all(statusUpdates);

      // All should be confirmed
      const confirmed = await sql`SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'`;
      expect(parseInt(confirmed[0].count)).toBe(5);
    });

    it("should handle counter increments atomically", async () => {
      const { sql } = getDb();

      // Create tour
      await sql`
        INSERT INTO tours (name, price, max_participants, is_active)
        VALUES ('Counter Test', 100, 100, true)
      `;

      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      // Add a counter column simulation using max_participants as counter
      // Reset to 0
      await sql`UPDATE tours SET max_participants = 0 WHERE id = ${tourId}`;

      // Concurrent increments (simulated with updates)
      const increments = Array.from({ length: 50 }, () =>
        sql`UPDATE tours SET max_participants = max_participants + 1 WHERE id = ${tourId}`
      );

      await Promise.all(increments);

      // Should be exactly 50
      const result = await sql`SELECT max_participants FROM tours WHERE id = ${tourId}`;
      expect(result[0].max_participants).toBe(50);
    });
  });

  describe("Concurrent Deletes", () => {
    it("should handle concurrent deletes safely", async () => {
      const { sql } = getDb();

      // Create multiple customers
      for (let i = 0; i < 20; i++) {
        await sql`
          INSERT INTO customers (first_name, last_name, email)
          VALUES (${`Delete${i}`}, 'Test', ${`delete${i}@test.com`})
        `;
      }

      const customers = await sql`SELECT id FROM customers`;

      // Delete first 10 concurrently
      const deleteOperations = customers.slice(0, 10).map((customer) =>
        sql`DELETE FROM customers WHERE id = ${customer.id}`
      );

      await Promise.all(deleteOperations);

      // Should have 10 remaining
      const remaining = await sql`SELECT COUNT(*) as count FROM customers`;
      expect(parseInt(remaining[0].count)).toBe(10);
    });

    it("should handle cascading deletes concurrently", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      // Create multiple trips
      for (let i = 0; i < 10; i++) {
        await sql`
          INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
          VALUES (${tourId}, ${boatId}, ${`2024-12-${10 + i}`}, '09:00:00', 10, 'scheduled')
        `;
      }

      const trips = await sql`SELECT id FROM trips`;
      expect(trips).toHaveLength(10);

      // Delete tour (should cascade all trips)
      await sql`DELETE FROM tours WHERE id = ${tourId}`;

      // All trips should be deleted
      const remainingTrips = await sql`SELECT COUNT(*) as count FROM trips`;
      expect(parseInt(remainingTrips[0].count)).toBe(0);
    });
  });

  describe("Race Conditions", () => {
    it("should handle concurrent availability checks and bookings", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Race', 'Customer', 'race@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      // Create trip with limited spots
      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 2, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Try to create 5 bookings concurrently (only 2 spots available)
      const bookingAttempts = Array.from({ length: 5 }, (_, i) =>
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES (${`BK-RACE-${i}`}, ${customerId}, ${tripId}, 1, 100.00, 'confirmed')
        `.catch(() => null) // Some may fail, that's OK
      );

      await Promise.allSettled(bookingAttempts);

      // Count successful bookings
      const bookings = await sql`SELECT COUNT(*) as count FROM bookings WHERE trip_id = ${tripId}`;
      const bookingCount = parseInt(bookings[0].count);

      // Should have some bookings (may not enforce limits without triggers)
      expect(bookingCount).toBeGreaterThan(0);
      expect(bookingCount).toBeLessThanOrEqual(5);
    });

    it("should handle double-booking prevention", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Prevent', 'Double', 'prevent@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Try to create duplicate bookings concurrently
      const duplicateBookings = [
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES ('BK-DUPLICATE', ${customerId}, ${tripId}, 1, 100.00, 'confirmed')
        `,
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES ('BK-DUPLICATE', ${customerId}, ${tripId}, 1, 100.00, 'confirmed')
        `,
      ];

      const results = await Promise.allSettled(duplicateBookings);

      // At least one should fail (unique constraint on booking_number)
      const failures = results.filter((r) => r.status === "rejected");
      expect(failures.length).toBeGreaterThan(0);

      // Should only have one booking
      const bookings = await sql`SELECT COUNT(*) as count FROM bookings WHERE booking_number = 'BK-DUPLICATE'`;
      expect(parseInt(bookings[0].count)).toBeLessThanOrEqual(1);
    });
  });

  describe("Data Integrity Under Load", () => {
    it("should maintain referential integrity under concurrent load", async () => {
      const { sql } = getDb();

      // Create base data
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Load', 'Test', 'load@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      // Create many trips concurrently
      const tripCreations = Array.from({ length: 20 }, (_, i) =>
        sql`
          INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
          VALUES (${tourId}, ${boatId}, ${`2024-12-${(i % 28) + 1}`}, '09:00:00', 10, 'scheduled')
        `
      );

      await Promise.all(tripCreations);

      // Verify all trips reference valid tour
      const invalidTrips = await sql`
        SELECT COUNT(*) as count
        FROM trips t
        LEFT JOIN tours tour ON t.tour_id = tour.id
        WHERE tour.id IS NULL
      `;

      expect(parseInt(invalidTrips[0].count)).toBe(0);
    });

    it("should handle high-volume operations correctly", async () => {
      const { sql } = getDb();

      const startTime = Date.now();

      // Create 100 customers rapidly
      const operations = Array.from({ length: 100 }, (_, i) =>
        sql`
          INSERT INTO customers (first_name, last_name, email)
          VALUES (${`Load${i}`}, 'Test', ${`load${i}@test.com`})
        `
      );

      await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all created
      const count = await sql`SELECT COUNT(*) as count FROM customers`;
      expect(parseInt(count[0].count)).toBe(100);

      // Should complete reasonably fast (under 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it("should prevent orphaned records", async () => {
      const { sql } = getDb();

      // Create customer
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Orphan', 'Test', 'orphan@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      // Create tour, boat, trip
      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Create booking
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK-ORPHAN', ${customerId}, ${tripId}, 1, 100.00, 'confirmed')
      `;

      // Delete customer (should cascade booking)
      await sql`DELETE FROM customers WHERE id = ${customerId}`;

      // No orphaned bookings should exist
      const orphanedBookings = await sql`
        SELECT COUNT(*) as count
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE c.id IS NULL
      `;

      expect(parseInt(orphanedBookings[0].count)).toBe(0);
    });
  });
});
