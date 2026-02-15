/**
 * Bookings Queries Integration Tests
 *
 * Tests database operations for bookings including complex joins,
 * filtering, and business logic validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../../setup/database";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  getBookingsByStatus,
  getBookingsByDateRange,
  getBookingsByCustomer,
} from "../../../../../lib/db/queries/bookings.server";

describe("Bookings Queries Integration Tests", () => {
  const getDb = useTestDatabase();
  const testOrgId = "test-org-bookings";
  let testCustomerId: string;
  let testTripId: number;

  beforeEach(async () => {
    const { db, sql } = getDb();

    // Create required tables
    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS tours (
        id SERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        max_participants INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS boats (
        id SERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        tour_id INTEGER REFERENCES tours(id),
        boat_id INTEGER REFERENCES boats(id),
        date DATE NOT NULL,
        time TIME NOT NULL,
        available_spots INTEGER,
        status VARCHAR(50) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id TEXT NOT NULL,
        booking_number TEXT UNIQUE NOT NULL,
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
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

    // Create test customer
    await sql`
      INSERT INTO customers (organization_id, email, first_name, last_name)
      VALUES (${testOrgId}, 'test@example.com', 'John', 'Doe')
    `;
    const customerResult = await sql`SELECT id FROM customers LIMIT 1`;
    testCustomerId = customerResult[0].id;

    // Create test tour, boat, and trip
    await sql`
      INSERT INTO tours (organization_id, name, price, max_participants)
      VALUES (${testOrgId}, 'Scuba Adventure', 150.00, 10)
    `;
    const tourResult = await sql`SELECT id FROM tours LIMIT 1`;
    const tourId = tourResult[0].id;

    await sql`
      INSERT INTO boats (organization_id, name, capacity)
      VALUES (${testOrgId}, 'Dive Master', 20)
    `;
    const boatResult = await sql`SELECT id FROM boats LIMIT 1`;
    const boatId = boatResult[0].id;

    await sql`
      INSERT INTO trips (organization_id, tour_id, boat_id, date, time, available_spots)
      VALUES (${testOrgId}, ${tourId}, ${boatId}, '2026-06-15', '09:00:00', 10)
    `;
    const tripResult = await sql`SELECT id FROM trips LIMIT 1`;
    testTripId = tripResult[0].id;
  });

  afterEach(async () => {
    const { db } = getDb();
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS bookings CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS trips CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS boats CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS tours CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS customers CASCADE`));
  });

  describe("getAllBookings", () => {
    it("should return all bookings for an organization", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total, status)
        VALUES
          (${testOrgId}, 'BK001', ${testCustomerId}, ${testTripId}, 2, 300.00, 'confirmed'),
          (${testOrgId}, 'BK002', ${testCustomerId}, ${testTripId}, 1, 150.00, 'pending')
      `;

      const bookings = await getAllBookings(testOrgId);

      expect(bookings).toHaveLength(2);
      expect(bookings[0].bookingNumber).toBe('BK001');
      expect(bookings[1].bookingNumber).toBe('BK002');
    });

    it("should return empty array when no bookings exist", async () => {
      const bookings = await getAllBookings("nonexistent-org");
      expect(bookings).toEqual([]);
    });

    it("should only return bookings for the specified organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      // Create customer for other org
      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${otherOrgId}, 'other@example.com', 'Jane', 'Smith')
      `;
      const otherCustomer = await sql`SELECT id FROM customers WHERE email = 'other@example.com' LIMIT 1`;

      // Create tour/boat/trip for other org
      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${otherOrgId}, 'Other Tour', 100)`;
      const otherTour = await sql`SELECT id FROM tours WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${otherOrgId}, 'Other Boat', 15)`;
      const otherBoat = await sql`SELECT id FROM boats WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`
        INSERT INTO trips (organization_id, tour_id, boat_id, date, time)
        VALUES (${otherOrgId}, ${otherTour[0].id}, ${otherBoat[0].id}, '2026-07-01', '10:00:00')
      `;
      const otherTrip = await sql`SELECT id FROM trips WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
        VALUES
          (${testOrgId}, 'BK001', ${testCustomerId}, ${testTripId}, 2, 300.00),
          (${otherOrgId}, 'BK002', ${otherCustomer[0].id}, ${otherTrip[0].id}, 1, 100.00)
      `;

      const bookings = await getAllBookings(testOrgId);

      expect(bookings).toHaveLength(1);
      expect(bookings[0].bookingNumber).toBe('BK001');
    });
  });

  describe("getBookingById", () => {
    it("should return booking with customer and trip details", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total, status, payment_status, notes)
        VALUES (${testOrgId}, 'BK123', ${testCustomerId}, ${testTripId}, 3, 450.00, 'confirmed', 'paid', 'Special celebration')
      `;

      const result = await sql`SELECT id FROM bookings WHERE booking_number = 'BK123' LIMIT 1`;
      const bookingId = result[0].id;

      const booking = await getBookingById(bookingId, testOrgId);

      expect(booking).toBeDefined();
      expect(booking?.bookingNumber).toBe('BK123');
      expect(booking?.participants).toBe(3);
      expect(booking?.total).toBe('450.00');
      expect(booking?.status).toBe('confirmed');
      expect(booking?.paymentStatus).toBe('paid');
      expect(booking?.notes).toBe('Special celebration');
    });

    it("should return null when booking does not exist", async () => {
      const booking = await getBookingById('00000000-0000-0000-0000-000000000000', testOrgId);
      expect(booking).toBeNull();
    });

    it("should not return booking from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      // Create minimal setup for other org
      await sql`INSERT INTO customers (organization_id, email, first_name, last_name) VALUES (${otherOrgId}, 'other@test.com', 'Other', 'User')`;
      const otherCustomer = await sql`SELECT id FROM customers WHERE email = 'other@test.com' LIMIT 1`;

      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${otherOrgId}, 'Tour', 100)`;
      const otherTour = await sql`SELECT id FROM tours WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${otherOrgId}, 'Boat', 10)`;
      const otherBoat = await sql`SELECT id FROM boats WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, time) VALUES (${otherOrgId}, ${otherTour[0].id}, ${otherBoat[0].id}, '2026-08-01', '11:00')`;
      const otherTrip = await sql`SELECT id FROM trips WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
        VALUES (${otherOrgId}, 'OTHER-BK', ${otherCustomer[0].id}, ${otherTrip[0].id}, 1, 100.00)
      `;

      const result = await sql`SELECT id FROM bookings WHERE booking_number = 'OTHER-BK' LIMIT 1`;
      const bookingId = result[0].id;

      const booking = await getBookingById(bookingId, testOrgId);
      expect(booking).toBeNull();
    });
  });

  describe("createBooking", () => {
    it("should create a new booking with all fields", async () => {
      const newBooking = {
        organizationId: testOrgId,
        bookingNumber: 'BK999',
        customerId: testCustomerId,
        tripId: testTripId,
        participants: 2,
        subtotal: 300.00,
        discount: 30.00,
        tax: 24.30,
        total: 294.30,
        specialRequests: 'Vegetarian meals',
        source: 'website',
        status: 'confirmed' as const,
        paymentStatus: 'pending' as const,
      };

      const createdBooking = await createBooking(newBooking);

      expect(createdBooking).toBeDefined();
      expect(createdBooking.bookingNumber).toBe('BK999');
      expect(createdBooking.participants).toBe(2);
      expect(createdBooking.total).toBe('294.30');
      expect(createdBooking.status).toBe('confirmed');

      // Verify in database
      const { sql } = getDb();
      const result = await sql`SELECT * FROM bookings WHERE id = ${createdBooking.id}`;
      expect(result).toHaveLength(1);
      expect(result[0].special_requests).toBe('Vegetarian meals');
    });

    it("should create booking with minimal required fields", async () => {
      const newBooking = {
        organizationId: testOrgId,
        bookingNumber: 'BK888',
        customerId: testCustomerId,
        tripId: testTripId,
        participants: 1,
        total: 150.00,
      };

      const createdBooking = await createBooking(newBooking);

      expect(createdBooking).toBeDefined();
      expect(createdBooking.status).toBe('pending'); // Default
      expect(createdBooking.paymentStatus).toBe('pending'); // Default
    });
  });

  describe("updateBooking", () => {
    it("should update booking status", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total, status)
        VALUES (${testOrgId}, 'BK-UPDATE', ${testCustomerId}, ${testTripId}, 2, 300.00, 'pending')
      `;

      const result = await sql`SELECT id FROM bookings WHERE booking_number = 'BK-UPDATE' LIMIT 1`;
      const bookingId = result[0].id;

      const updates = {
        status: 'confirmed' as const,
        paymentStatus: 'paid' as const,
      };

      const updatedBooking = await updateBooking(bookingId, testOrgId, updates);

      expect(updatedBooking).toBeDefined();
      expect(updatedBooking?.status).toBe('confirmed');
      expect(updatedBooking?.paymentStatus).toBe('paid');
    });

    it("should update booking notes", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
        VALUES (${testOrgId}, 'BK-NOTES', ${testCustomerId}, ${testTripId}, 1, 150.00)
      `;

      const result = await sql`SELECT id FROM bookings WHERE booking_number = 'BK-NOTES' LIMIT 1`;
      const bookingId = result[0].id;

      const updates = {
        notes: 'Customer called to confirm pickup location',
      };

      const updatedBooking = await updateBooking(bookingId, testOrgId, updates);

      expect(updatedBooking?.notes).toBe('Customer called to confirm pickup location');
    });

    it("should not update booking from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org-bookings";

      // Minimal setup for other org
      await sql`INSERT INTO customers (organization_id, email, first_name, last_name) VALUES (${otherOrgId}, 'diff@test.com', 'Diff', 'User')`;
      const diffCustomer = await sql`SELECT id FROM customers WHERE email = 'diff@test.com' LIMIT 1`;

      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${otherOrgId}, 'Tour', 100)`;
      const diffTour = await sql`SELECT id FROM tours WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${otherOrgId}, 'Boat', 10)`;
      const diffBoat = await sql`SELECT id FROM boats WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, time) VALUES (${otherOrgId}, ${diffTour[0].id}, ${diffBoat[0].id}, '2026-09-01', '12:00')`;
      const diffTrip = await sql`SELECT id FROM trips WHERE organization_id = ${otherOrgId} LIMIT 1`;

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total, status)
        VALUES (${otherOrgId}, 'DIFF-BK', ${diffCustomer[0].id}, ${diffTrip[0].id}, 1, 100.00, 'pending')
      `;

      const result = await sql`SELECT id FROM bookings WHERE booking_number = 'DIFF-BK' LIMIT 1`;
      const bookingId = result[0].id;

      const updates = { status: 'cancelled' as const };
      const updatedBooking = await updateBooking(bookingId, testOrgId, updates);

      expect(updatedBooking).toBeNull();

      // Verify booking wasn't updated
      const dbResult = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
      expect(dbResult[0].status).toBe('pending');
    });
  });

  describe("getBookingsByStatus", () => {
    it("should filter bookings by status", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total, status)
        VALUES
          (${testOrgId}, 'BK-CONF1', ${testCustomerId}, ${testTripId}, 1, 150.00, 'confirmed'),
          (${testOrgId}, 'BK-CONF2', ${testCustomerId}, ${testTripId}, 2, 300.00, 'confirmed'),
          (${testOrgId}, 'BK-PEND', ${testCustomerId}, ${testTripId}, 1, 150.00, 'pending'),
          (${testOrgId}, 'BK-CANC', ${testCustomerId}, ${testTripId}, 3, 450.00, 'cancelled')
      `;

      const confirmedBookings = await getBookingsByStatus(testOrgId, 'confirmed');

      expect(confirmedBookings).toHaveLength(2);
      expect(confirmedBookings.every(b => b.status === 'confirmed')).toBe(true);
    });
  });

  describe("getBookingsByCustomer", () => {
    it("should return all bookings for a specific customer", async () => {
      const { sql } = getDb();

      // Create second customer
      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'customer2@test.com', 'Jane', 'Smith')
      `;
      const customer2Result = await sql`SELECT id FROM customers WHERE email = 'customer2@test.com' LIMIT 1`;
      const customer2Id = customer2Result[0].id;

      await sql`
        INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
        VALUES
          (${testOrgId}, 'BK-C1-1', ${testCustomerId}, ${testTripId}, 1, 150.00),
          (${testOrgId}, 'BK-C1-2', ${testCustomerId}, ${testTripId}, 2, 300.00),
          (${testOrgId}, 'BK-C2-1', ${customer2Id}, ${testTripId}, 1, 150.00)
      `;

      const customer1Bookings = await getBookingsByCustomer(testOrgId, testCustomerId);

      expect(customer1Bookings).toHaveLength(2);
      expect(customer1Bookings.every(b => b.customerId === testCustomerId)).toBe(true);
    });
  });

  describe("getBookingsByDateRange", () => {
    it("should filter bookings within date range", async () => {
      const { sql } = getDb();

      // Create trips on different dates
      await sql`
        INSERT INTO trips (organization_id, tour_id, boat_id, date, time)
        SELECT
          ${testOrgId},
          (SELECT id FROM tours LIMIT 1),
          (SELECT id FROM boats LIMIT 1),
          date_val,
          '09:00:00'
        FROM (VALUES
          ('2026-06-01'::date),
          ('2026-06-15'::date),
          ('2026-06-30'::date),
          ('2026-07-15'::date)
        ) AS dates(date_val)
      `;

      const trips = await sql`SELECT id, date FROM trips ORDER BY date`;

      // Create bookings for each trip
      for (const trip of trips) {
        await sql`
          INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
          VALUES (${testOrgId}, 'BK-' || ${trip.id}, ${testCustomerId}, ${trip.id}, 1, 150.00)
        `;
      }

      const bookings = await getBookingsByDateRange(testOrgId, '2026-06-01', '2026-06-30');

      expect(bookings).toHaveLength(3); // June dates only
    });
  });
});
