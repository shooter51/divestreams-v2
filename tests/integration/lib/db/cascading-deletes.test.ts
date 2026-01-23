/**
 * Cascading Deletes and Foreign Key Constraints Integration Tests
 *
 * Tests cascading delete behavior, foreign key constraints,
 * and referential integrity across related tables.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../setup/database";

describe.skip("Cascading Deletes and Foreign Key Constraints", () => {
  const getDb = useTestDatabase();
  const testSchema = "tenant_cascade";

  beforeEach(async () => {
    const { db } = getDb();
    await createTestTenantSchema(db, testSchema);
    await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, testSchema);
  });

  describe("Customer Cascade Deletes", () => {
    it("should cascade delete customer bookings when customer is deleted", async () => {
      const { sql } = getDb();

      // Create customer
      await sql`
        INSERT INTO customers (first_name, last_name, email, organization_id)
        VALUES ('Delete', 'Me', 'deleteme@test.com', 'test-org')
      `;
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
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK001', ${customerId}, ${tripId}, 2, 200.00, 'confirmed', 'test-org')
      `;

      // Verify booking exists
      let bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customerId}`;
      expect(bookings).toHaveLength(1);

      // Delete customer
      await sql`DELETE FROM customers WHERE id = ${customerId}`;

      // Bookings should be deleted (cascade)
      bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customerId}`;
      expect(bookings).toHaveLength(0);
    });

    it("should cascade delete payments when booking is deleted", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('Test', 'Customer', 'test@test.com', 'test-org')`;
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

      // Create booking
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK002', ${customerId}, ${tripId}, 2, 200.00, 'confirmed', 'test-org')
      `;
      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK002'`;
      const bookingId = booking[0].id;

      // Create payments
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 100.00, 'credit_card', 'completed')
      `;
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 100.00, 'cash', 'completed')
      `;

      // Verify payments exist
      let payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(2);

      // Delete booking
      await sql`DELETE FROM bookings WHERE id = ${bookingId}`;

      // Payments should be deleted (cascade)
      payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(0);
    });
  });

  describe("Trip Cascade Deletes", () => {
    it("should cascade delete bookings when trip is deleted", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('C1', 'Test', 'c1@test.com', 'test-org')`;
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('C2', 'Test', 'c2@test.com', 'test-org')`;
      const customers = await sql`SELECT id FROM customers ORDER BY email`;
      const customer1Id = customers[0].id;
      const customer2Id = customers[1].id;

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

      // Create multiple bookings for this trip
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK003', ${customer1Id}, ${tripId}, 2, 200.00, 'confirmed', 'test-org')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK004', ${customer2Id}, ${tripId}, 1, 100.00, 'confirmed', 'test-org')
      `;

      // Verify bookings exist
      let bookings = await sql`SELECT * FROM bookings WHERE trip_id = ${tripId}`;
      expect(bookings).toHaveLength(2);

      // Delete trip
      await sql`DELETE FROM trips WHERE id = ${tripId}`;

      // All bookings for this trip should be deleted
      bookings = await sql`SELECT * FROM bookings WHERE trip_id = ${tripId}`;
      expect(bookings).toHaveLength(0);
    });

    it("should handle trip deletion with payments cascade", async () => {
      const { sql } = getDb();

      // Setup
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('Pay', 'Customer', 'pay@test.com', 'test-org')`;
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

      // Create booking with payment
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK005', ${customerId}, ${tripId}, 2, 200.00, 'confirmed', 'test-org')
      `;
      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK005'`;
      const bookingId = booking[0].id;

      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 200.00, 'credit_card', 'completed')
      `;

      // Verify payment exists
      let payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(1);

      // Delete trip (should cascade to booking, then to payment)
      await sql`DELETE FROM trips WHERE id = ${tripId}`;

      // Payment should be deleted
      payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(0);
    });
  });

  describe("Foreign Key Constraint Validation", () => {
    it("should reject booking without valid customer", async () => {
      const { sql } = getDb();

      // Setup trip
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

      // Try to create booking with non-existent customer
      await expect(
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
          VALUES ('BK006', 99999, ${tripId}, 2, 200.00, 'confirmed', 'test-org')
        `
      ).rejects.toThrow();
    });

    it("should reject trip without valid tour", async () => {
      const { sql } = getDb();

      // Setup boat only
      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      // Try to create trip with non-existent tour
      await expect(
        sql`
          INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
          VALUES (99999, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
        `
      ).rejects.toThrow();
    });

    it("should reject payment without valid booking", async () => {
      const { sql } = getDb();

      // Try to create payment with non-existent booking
      await expect(
        sql`
          INSERT INTO payments (booking_id, amount, method, status)
          VALUES (99999, 200.00, 'credit_card', 'completed')
        `
      ).rejects.toThrow();
    });
  });

  describe("Complex Cascade Scenarios", () => {
    it("should handle multi-level cascades (tour -> trips -> bookings -> payments)", async () => {
      const { sql } = getDb();

      // Create customer
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('Multi', 'Cascade', 'multi@test.com', 'test-org')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      // Create tour
      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Delete Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      // Create boat
      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      // Create multiple trips for this tour
      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-26', '09:00:00', 10, 'scheduled')
      `;

      const trips = await sql`SELECT id FROM trips WHERE tour_id = ${tourId}`;
      const trip1Id = trips[0].id;
      const trip2Id = trips[1].id;

      // Create bookings for both trips
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK007', ${customerId}, ${trip1Id}, 2, 200.00, 'confirmed', 'test-org')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK008', ${customerId}, ${trip2Id}, 2, 200.00, 'confirmed', 'test-org')
      `;

      const bookings = await sql`SELECT id FROM bookings`;
      const booking1Id = bookings[0].id;
      const booking2Id = bookings[1].id;

      // Create payments for both bookings
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${booking1Id}, 200.00, 'credit_card', 'completed')
      `;
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${booking2Id}, 200.00, 'cash', 'completed')
      `;

      // Verify all data exists
      let allTrips = await sql`SELECT * FROM trips WHERE tour_id = ${tourId}`;
      let allBookings = await sql`SELECT * FROM bookings`;
      let allPayments = await sql`SELECT * FROM payments`;

      expect(allTrips).toHaveLength(2);
      expect(allBookings).toHaveLength(2);
      expect(allPayments).toHaveLength(2);

      // Delete the tour (should cascade to trips -> bookings -> payments)
      await sql`DELETE FROM tours WHERE id = ${tourId}`;

      // Verify everything is deleted
      allTrips = await sql`SELECT * FROM trips WHERE tour_id = ${tourId}`;
      allBookings = await sql`SELECT * FROM bookings WHERE trip_id IN (${trip1Id}, ${trip2Id})`;
      allPayments = await sql`SELECT * FROM payments`;

      expect(allTrips).toHaveLength(0);
      expect(allBookings).toHaveLength(0);
      expect(allPayments).toHaveLength(0);
    });

    it("should preserve referential integrity during partial deletes", async () => {
      const { sql } = getDb();

      // Create two customers
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('Keep', 'Me', 'keep@test.com', 'test-org')`;
      await sql`INSERT INTO customers (first_name, last_name, email, organization_id) VALUES ('Delete', 'Me', 'delete@test.com', 'test-org')`;

      const customers = await sql`SELECT id FROM customers ORDER BY email`;
      const deleteCustomerId = customers[0].id;
      const keepCustomerId = customers[1].id;

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

      // Create bookings for both customers on same trip
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK009', ${keepCustomerId}, ${tripId}, 1, 100.00, 'confirmed', 'test-org')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status, organization_id)
        VALUES ('BK010', ${deleteCustomerId}, ${tripId}, 1, 100.00, 'confirmed', 'test-org')
      `;

      // Verify both bookings exist
      let bookings = await sql`SELECT * FROM bookings`;
      expect(bookings).toHaveLength(2);

      // Delete one customer
      await sql`DELETE FROM customers WHERE id = ${deleteCustomerId}`;

      // Only one booking should remain (the one for kept customer)
      bookings = await sql`SELECT * FROM bookings`;
      expect(bookings).toHaveLength(1);
      expect(bookings[0].customer_id).toBe(keepCustomerId);

      // Trip should still exist
      const trips = await sql`SELECT * FROM trips WHERE id = ${tripId}`;
      expect(trips).toHaveLength(1);
    });
  });
});
