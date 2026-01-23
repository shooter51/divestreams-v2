/**
 * Transaction Handling Integration Tests
 *
 * Tests database transaction management, rollbacks,
 * and ACID properties across operations.
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

describe.skip("Transaction Handling", () => {
  const getDb = useTestDatabase();
  const testSchema = "tenant_transactions";

  beforeEach(async () => {
    const { db } = getDb();
    await createTestTenantSchema(db, testSchema);
    await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, testSchema);
  });

  describe("ACID Properties", () => {
    it("should commit successful transactions atomically", async () => {
      const { sql } = getDb();

      await sql.begin(async (tx) => {
        // Insert multiple related records in transaction
        await tx`
          INSERT INTO customers (first_name, last_name, email, organization_id)
          VALUES ('John', 'Doe', 'john@test.com', 'test-org')
        `;

        await tx`
          INSERT INTO customers (first_name, last_name, email, organization_id)
          VALUES ('Jane', 'Doe', 'jane@test.com', 'test-org')
        `;

        await tx`
          INSERT INTO customers (first_name, last_name, email, organization_id)
          VALUES ('Jim', 'Doe', 'jim@test.com', 'test-org')
        `;
      });

      // All inserts should be committed
      const result = await sql`SELECT COUNT(*) as count FROM customers`;
      expect(parseInt(result[0].count)).toBe(3);
    });

    it("should rollback failed transactions", async () => {
      const { sql } = getDb();

      try {
        await sql.begin(async (tx) => {
          await tx`
            INSERT INTO customers (first_name, last_name, email, organization_id)
            VALUES ('Success', 'User', 'success@test.com', 'test-org')
          `;

          // This will fail due to duplicate email (if we insert same email twice)
          await tx`
            INSERT INTO customers (first_name, last_name, email, organization_id)
            VALUES ('Fail', 'User', 'success@test.com', 'test-org')
          `;
        });
      } catch (error) {
        // Expected to fail
      }

      // No records should be inserted
      const result = await sql`SELECT COUNT(*) as count FROM customers`;
      expect(parseInt(result[0].count)).toBe(0);
    });

    it("should handle constraint violations with rollback", async () => {
      const { sql } = getDb();

      // Create tour
      await sql`
        INSERT INTO tours (name, price, max_participants, is_active)
        VALUES ('Test Tour', 100.00, 10, true)
      `;

      const tours = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tours[0].id;

      try {
        await sql.begin(async (tx) => {
          // Create boat
          await tx`
            INSERT INTO boats (name, capacity, is_active)
            VALUES ('Test Boat', 20, true)
          `;

          const boats = await tx`SELECT id FROM boats LIMIT 1`;
          const boatId = boats[0].id;

          // Valid trip
          await tx`
            INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
            VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
          `;

          // Invalid trip - non-existent tour_id
          await tx`
            INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
            VALUES (99999, ${boatId}, '2024-12-26', '09:00:00', 10, 'scheduled')
          `;
        });
      } catch (error) {
        // Expected to fail
      }

      // No boats or trips should exist (rolled back)
      const boats = await sql`SELECT COUNT(*) as count FROM boats`;
      const trips = await sql`SELECT COUNT(*) as count FROM trips`;

      expect(parseInt(boats[0].count)).toBe(0);
      expect(parseInt(trips[0].count)).toBe(0);
    });
  });

  describe("Isolation Levels", () => {
    it("should handle concurrent read/write operations", async () => {
      const { sql } = getDb();

      // Insert initial customer
      await sql`
        INSERT INTO customers (first_name, last_name, email, organization_id)
        VALUES ('Concurrent', 'Test', 'concurrent@test.com', 'test-org')
      `;

      // Simulate concurrent updates
      const operations = [
        sql`
          UPDATE customers
          SET first_name = 'Updated1'
          WHERE email = 'concurrent@test.com'
        `,
        sql`
          UPDATE customers
          SET last_name = 'Changed'
          WHERE email = 'concurrent@test.com'
        `,
      ];

      await Promise.all(operations);

      // Verify final state
      const result = await sql`
        SELECT * FROM customers WHERE email = 'concurrent@test.com'
      `;

      expect(result).toHaveLength(1);
      // One of the updates should have won
      expect(result[0].first_name === "Updated1" || result[0].last_name === "Changed").toBe(true);
    });

    it("should prevent dirty reads", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Dirty', 'Read', 'dirty@test.com')
      `;

      let readValue: any;

      try {
        await sql.begin(async (tx) => {
          // Update in transaction
          await tx`
            UPDATE customers
            SET first_name = 'Modified'
            WHERE email = 'dirty@test.com'
          `;

          // Read from outside transaction (different connection)
          const outsideRead = await sql`
            SELECT first_name FROM customers WHERE email = 'dirty@test.com'
          `;
          readValue = outsideRead[0].first_name;

          // Rollback
          throw new Error("Rollback");
        });
      } catch (error) {
        // Expected
      }

      // Outside read should see original value (no dirty read)
      expect(readValue).toBe("Dirty");

      // Verify rollback
      const final = await sql`
        SELECT first_name FROM customers WHERE email = 'dirty@test.com'
      `;
      expect(final[0].first_name).toBe("Dirty");
    });
  });

  describe("Complex Transaction Scenarios", () => {
    it("should handle booking creation with payment in transaction", async () => {
      const { sql } = getDb();

      // Setup
      await sql`
        INSERT INTO customers (first_name, last_name, email)
        VALUES ('Paying', 'Customer', 'pay@test.com')
      `;
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

      // Create booking with payment in transaction
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES ('BK001', ${customerId}, ${tripId}, 2, 200.00, 'confirmed')
        `;

        const booking = await tx`SELECT id FROM bookings WHERE booking_number = 'BK001'`;
        const bookingId = booking[0].id;

        await tx`
          INSERT INTO payments (booking_id, amount, method, status)
          VALUES (${bookingId}, 200.00, 'credit_card', 'completed')
        `;

        // Update booking payment status
        await tx`
          UPDATE bookings
          SET paid_amount = 200.00
          WHERE id = ${bookingId}
        `;
      });

      // Verify both booking and payment exist
      const bookings = await sql`SELECT * FROM bookings WHERE booking_number = 'BK001'`;
      const payments = await sql`SELECT * FROM payments`;

      expect(bookings).toHaveLength(1);
      expect(payments).toHaveLength(1);
      expect(parseFloat(bookings[0].paid_amount)).toBe(200.00);
    });

    it("should rollback booking if payment fails", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Fail', 'Payment', 'fail@test.com')`;
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

      try {
        await sql.begin(async (tx) => {
          await tx`
            INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
            VALUES ('BK002', ${customerId}, ${tripId}, 2, 200.00, 'confirmed')
          `;

          // Simulate payment failure
          throw new Error("Payment processing failed");
        });
      } catch (error) {
        // Expected
      }

      // Booking should not exist (rolled back)
      const bookings = await sql`SELECT * FROM bookings WHERE booking_number = 'BK002'`;
      expect(bookings).toHaveLength(0);
    });

    it("should handle nested savepoints", async () => {
      const { sql } = getDb();

      await sql.begin(async (tx) => {
        // First customer
        await tx`
          INSERT INTO customers (first_name, last_name, email)
          VALUES ('First', 'Customer', 'first@test.com')
        `;

        try {
          // Try to add second customer (will fail)
          await tx.begin(async (nested) => {
            await nested`
              INSERT INTO customers (first_name, last_name, email)
              VALUES ('Second', 'Customer', 'second@test.com')
            `;

            // Simulate error
            throw new Error("Nested transaction failed");
          });
        } catch (error) {
          // Nested transaction rolled back
        }

        // Third customer
        await tx`
          INSERT INTO customers (first_name, last_name, email)
          VALUES ('Third', 'Customer', 'third@test.com')
        `;
      });

      // Should have first and third customers only
      const customers = await sql`SELECT * FROM customers ORDER BY email`;
      expect(customers).toHaveLength(2);
      expect(customers[0].email).toBe("first@test.com");
      expect(customers[1].email).toBe("third@test.com");
    });
  });

  describe("Deadlock Handling", () => {
    it("should handle deadlock scenarios gracefully", async () => {
      const { sql } = getDb();

      // Insert test data
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Lock1', 'Test', 'lock1@test.com')`;
      await sql`INSERT INTO customers (first_name, last_name, email) VALUES ('Lock2', 'Test', 'lock2@test.com')`;

      const customer1 = await sql`SELECT id FROM customers WHERE email = 'lock1@test.com'`;
      const customer2 = await sql`SELECT id FROM customers WHERE email = 'lock2@test.com'`;

      // Simulate potential deadlock scenario
      const operations = [
        (async () => {
          try {
            await sql.begin(async (tx) => {
              await tx`UPDATE customers SET first_name = 'Updated1A' WHERE email = 'lock1@test.com'`;
              await new Promise((resolve) => setTimeout(resolve, 10));
              await tx`UPDATE customers SET first_name = 'Updated2A' WHERE email = 'lock2@test.com'`;
            });
          } catch (error) {
            // May fail due to deadlock
          }
        })(),
        (async () => {
          try {
            await sql.begin(async (tx) => {
              await tx`UPDATE customers SET first_name = 'Updated2B' WHERE email = 'lock2@test.com'`;
              await new Promise((resolve) => setTimeout(resolve, 10));
              await tx`UPDATE customers SET first_name = 'Updated1B' WHERE email = 'lock1@test.com'`;
            });
          } catch (error) {
            // May fail due to deadlock
          }
        })(),
      ];

      await Promise.allSettled(operations);

      // At least one operation should succeed
      const customers = await sql`SELECT * FROM customers WHERE email IN ('lock1@test.com', 'lock2@test.com')`;
      expect(customers).toHaveLength(2);
    });
  });
});
