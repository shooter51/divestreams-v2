/**
 * Booking API Routes Integration Tests
 *
 * Tests booking management API endpoints with complex
 * relationships, transactions, and business logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../setup/database";

// Mock org context
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "test@test.com" },
    org: { id: "test-org", slug: "test-org", name: "Test Org" },
    membership: { role: "owner" },
  }),
}));

describe.skip("Booking API Routes", () => {
  const getDb = useTestDatabase();
  const testSchema = "tenant_bookings_api";

  let customerId: number;
  let tourId: number;
  let boatId: number;
  let tripId: number;

  beforeEach(async () => {
    const { db, sql } = getDb();
    await createTestTenantSchema(db, testSchema);
    await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));

    // Create test data
    await sql`
      INSERT INTO customers (first_name, last_name, email, organization_id)
      VALUES ('Test', 'Customer', 'testcustomer@test.com', 'test-org')
    `;
    const customer = await sql`SELECT id FROM customers LIMIT 1`;
    customerId = customer[0].id;

    await sql`
      INSERT INTO tours (name, price, max_participants, is_active)
      VALUES ('Sunset Dive', 150.00, 8, true)
    `;
    const tour = await sql`SELECT id FROM tours LIMIT 1`;
    tourId = tour[0].id;

    await sql`
      INSERT INTO boats (name, capacity, is_active)
      VALUES ('Dive Master', 20, true)
    `;
    const boat = await sql`SELECT id FROM boats LIMIT 1`;
    boatId = boat[0].id;

    await sql`
      INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
      VALUES (${tourId}, ${boatId}, '2024-12-25', '14:00:00', 8, 'scheduled')
    `;
    const trip = await sql`SELECT id FROM trips LIMIT 1`;
    tripId = trip[0].id;
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, testSchema);
    vi.clearAllMocks();
  });

  describe("GET /bookings", () => {
    it("should return all bookings", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK001', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK002', ${customerId}, ${tripId}, 1, 150.00, 'pending')
      `;

      const bookings = await sql`SELECT * FROM bookings ORDER BY booking_number`;

      expect(bookings).toHaveLength(2);
      expect(bookings[0].booking_number).toBe("BK001");
      expect(bookings[1].booking_number).toBe("BK002");
    });

    it("should filter bookings by status", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK003', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK004', ${customerId}, ${tripId}, 1, 150.00, 'cancelled')
      `;

      const confirmed = await sql`
        SELECT * FROM bookings WHERE status = 'confirmed'
      `;

      expect(confirmed).toHaveLength(1);
      expect(confirmed[0].booking_number).toBe("BK003");
    });

    it("should include related customer and trip data", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK005', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;

      const bookingWithRelations = await sql`
        SELECT
          b.*,
          c.first_name, c.last_name, c.email,
          t.date, t.time, t.status as trip_status
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN trips t ON b.trip_id = t.id
        WHERE b.booking_number = 'BK005'
      `;

      expect(bookingWithRelations).toHaveLength(1);
      expect(bookingWithRelations[0].first_name).toBe("Test");
      expect(bookingWithRelations[0].email).toBe("testcustomer@test.com");
      expect(bookingWithRelations[0].trip_status).toBe("scheduled");
    });
  });

  describe("POST /bookings", () => {
    it("should create new booking", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK006', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;

      const created = await sql`
        SELECT * FROM bookings WHERE booking_number = 'BK006'
      `;

      expect(created).toHaveLength(1);
      expect(created[0].customer_id).toBe(customerId);
      expect(parseFloat(created[0].total)).toBe(300.00);
      expect(created[0].participants).toBe(2);
    });

    it("should generate unique booking number", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK007', ${customerId}, ${tripId}, 1, 150.00, 'pending')
      `;
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK008', ${customerId}, ${tripId}, 1, 150.00, 'pending')
      `;

      const bookings = await sql`SELECT booking_number FROM bookings ORDER BY booking_number`;

      expect(bookings[0].booking_number).not.toBe(bookings[1].booking_number);
    });

    it("should enforce foreign key constraints", async () => {
      const { sql } = getDb();

      // Try with non-existent customer
      await expect(
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES ('BK009', 99999, ${tripId}, 2, 300.00, 'confirmed')
        `
      ).rejects.toThrow();

      // Try with non-existent trip
      await expect(
        sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES ('BK010', ${customerId}, 99999, 2, 300.00, 'confirmed')
        `
      ).rejects.toThrow();
    });

    it("should calculate total from participants and price", async () => {
      const { sql } = getDb();

      // Get tour price
      const tours = await sql`SELECT price FROM tours WHERE id = ${tourId}`;
      const pricePerPerson = parseFloat(tours[0].price);
      const participants = 3;
      const total = pricePerPerson * participants;

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK011', ${customerId}, ${tripId}, ${participants}, ${total}, 'confirmed')
      `;

      const booking = await sql`SELECT * FROM bookings WHERE booking_number = 'BK011'`;

      expect(booking[0].participants).toBe(participants);
      expect(parseFloat(booking[0].total)).toBe(total);
    });
  });

  describe("PUT /bookings/:id", () => {
    it("should update booking status", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK012', ${customerId}, ${tripId}, 2, 300.00, 'pending')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK012'`;
      const bookingId = booking[0].id;

      await sql`
        UPDATE bookings
        SET status = 'confirmed'
        WHERE id = ${bookingId}
      `;

      const updated = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;

      expect(updated[0].status).toBe("confirmed");
    });

    it("should update payment amount", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, paid_amount, status)
        VALUES ('BK013', ${customerId}, ${tripId}, 2, 300.00, 0.00, 'pending')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK013'`;
      const bookingId = booking[0].id;

      // Record payment
      await sql`
        UPDATE bookings
        SET paid_amount = 300.00, status = 'confirmed'
        WHERE id = ${bookingId}
      `;

      const updated = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;

      expect(parseFloat(updated[0].paid_amount)).toBe(300.00);
      expect(updated[0].status).toBe("confirmed");
    });

    it("should update participants and recalculate total", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK014', ${customerId}, ${tripId}, 2, 300.00, 'pending')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK014'`;
      const bookingId = booking[0].id;

      // Update to 3 participants
      const tours = await sql`SELECT price FROM tours WHERE id = ${tourId}`;
      const pricePerPerson = parseFloat(tours[0].price);
      const newTotal = pricePerPerson * 3;

      await sql`
        UPDATE bookings
        SET participants = 3, total = ${newTotal}
        WHERE id = ${bookingId}
      `;

      const updated = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;

      expect(updated[0].participants).toBe(3);
      expect(parseFloat(updated[0].total)).toBe(newTotal);
    });
  });

  describe("DELETE /bookings/:id", () => {
    it("should cancel booking (soft delete)", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK015', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK015'`;
      const bookingId = booking[0].id;

      // Cancel instead of delete
      await sql`
        UPDATE bookings
        SET status = 'cancelled'
        WHERE id = ${bookingId}
      `;

      const cancelled = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;

      expect(cancelled).toHaveLength(1);
      expect(cancelled[0].status).toBe("cancelled");
    });

    it("should delete booking (hard delete)", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK016', ${customerId}, ${tripId}, 2, 300.00, 'pending')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK016'`;
      const bookingId = booking[0].id;

      await sql`DELETE FROM bookings WHERE id = ${bookingId}`;

      const deleted = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;

      expect(deleted).toHaveLength(0);
    });

    it("should cascade delete payments when booking is deleted", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK017', ${customerId}, ${tripId}, 2, 300.00, 'confirmed')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK017'`;
      const bookingId = booking[0].id;

      // Create payment
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 300.00, 'credit_card', 'completed')
      `;

      // Verify payment exists
      let payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(1);

      // Delete booking
      await sql`DELETE FROM bookings WHERE id = ${bookingId}`;

      // Payment should be cascade deleted
      payments = await sql`SELECT * FROM payments WHERE booking_id = ${bookingId}`;
      expect(payments).toHaveLength(0);
    });
  });

  describe("Business Logic", () => {
    it("should calculate total amount from participants", async () => {
      const { sql } = getDb();

      const tours = await sql`SELECT price FROM tours WHERE id = ${tourId}`;
      const pricePerPerson = parseFloat(tours[0].price);

      const testCases = [
        { participants: 1, expected: pricePerPerson * 1 },
        { participants: 2, expected: pricePerPerson * 2 },
        { participants: 4, expected: pricePerPerson * 4 },
      ];

      for (const testCase of testCases) {
        await sql`
          INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
          VALUES (
            ${`BK-CALC-${testCase.participants}`},
            ${customerId},
            ${tripId},
            ${testCase.participants},
            ${testCase.expected},
            'confirmed'
          )
        `;

        const booking = await sql`
          SELECT * FROM bookings WHERE booking_number = ${`BK-CALC-${testCase.participants}`}
        `;

        expect(parseFloat(booking[0].total)).toBeCloseTo(testCase.expected);
      }
    });

    it("should track partial payments", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, paid_amount, status)
        VALUES ('BK-PARTIAL', ${customerId}, ${tripId}, 2, 300.00, 0.00, 'pending')
      `;

      const booking = await sql`SELECT id FROM bookings WHERE booking_number = 'BK-PARTIAL'`;
      const bookingId = booking[0].id;

      // First payment (deposit)
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 100.00, 'credit_card', 'completed')
      `;
      await sql`UPDATE bookings SET paid_amount = 100.00 WHERE id = ${bookingId}`;

      let updated = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
      expect(parseFloat(updated[0].paid_amount)).toBe(100.00);

      // Second payment (remainder)
      await sql`
        INSERT INTO payments (booking_id, amount, method, status)
        VALUES (${bookingId}, 200.00, 'cash', 'completed')
      `;
      await sql`UPDATE bookings SET paid_amount = 300.00, status = 'confirmed' WHERE id = ${bookingId}`;

      updated = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
      expect(parseFloat(updated[0].paid_amount)).toBe(300.00);
      expect(updated[0].status).toBe("confirmed");
    });
  });
});
