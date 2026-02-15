/**
 * Database Queries Integration Tests
 *
 * Tests real database operations, constraints, and multi-tenant isolation
 * using testcontainers PostgreSQL. Validates that query functions work
 * correctly with an actual database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import { useTestDatabase } from "../../../setup/database";
import { getTenantDb } from "../../../../lib/db/tenant.server";

// Import actual query functions
import {
  getAllBoats,
  getBoatById,
  createBoat,
  deleteBoat
} from "../../../../lib/db/queries/boats.server";

import {
  getCustomers,
  getCustomerById,
  createCustomer,
  deleteCustomer,
  getCustomerBookings
} from "../../../../lib/db/queries/customers.server";

import {
  getBookings,
  getBookingById,
  createBooking,
  getRecentBookings
} from "../../../../lib/db/queries/bookings.server";

describe("Database Queries Integration Tests", () => {
  const getDb = useTestDatabase();
  const testOrgId = "test-org-integration";

  // Setup schema before all tests
  beforeAll(async () => {
    const { db } = getDb();

    // Create all required tables matching the actual schema
    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS boats (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL,
        type VARCHAR(100),
        registration_number VARCHAR(100),
        amenities TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, email)
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS tours (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration VARCHAR(100),
        price DECIMAL(10,2) NOT NULL,
        max_participants INTEGER,
        difficulty VARCHAR(50),
        includes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        tour_id TEXT REFERENCES tours(id),
        boat_id TEXT REFERENCES boats(id),
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME,
        available_spots INTEGER,
        status VARCHAR(50) DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `));

    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        booking_number TEXT UNIQUE NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
        trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
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
  });

  // Clean up data between tests (not the schema)
  beforeEach(async () => {
    const { db } = getDb();
    await db.execute(drizzleSql.raw(`TRUNCATE TABLE bookings, trips, tours, customers, boats CASCADE`));
  });

  afterAll(async () => {
    const { db } = getDb();
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS bookings CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS trips CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS tours CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS customers CASCADE`));
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS boats CASCADE`));
  });

  describe("Boats Queries", () => {
    it("should create and retrieve a boat", async () => {
      const boat = await createBoat(testOrgId, {
        name: "Test Boat",
        capacity: 20,
        description: "A test boat",
      });

      expect(boat).toBeDefined();
      expect(boat.name).toBe("Test Boat");
      expect(boat.capacity).toBe(20);

      const retrieved = await getBoatById(testOrgId, boat.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(boat.id);
    });

    it("should return only active boats for getAllBoats", async () => {
      await createBoat(testOrgId, { name: "Active Boat", capacity: 15, isActive: true });
      await createBoat(testOrgId, { name: "Inactive Boat", capacity: 10, isActive: false });

      const boats = await getAllBoats(testOrgId);

      // getAllBoats only returns active boats
      expect(boats.length).toBe(1);
      expect(boats[0].name).toBe("Active Boat");
    });

    it("should enforce multi-tenant isolation", async () => {
      const org1Id = "org-1";
      const org2Id = "org-2";

      const boat1 = await createBoat(org1Id, { name: "Org1 Boat", capacity: 20 });
      await createBoat(org2Id, { name: "Org2 Boat", capacity: 15 });

      // Should not see org2's boat
      const retrieved = await getBoatById(org1Id, boat1.id);
      expect(retrieved).toBeDefined();

      // Try to access org1's boat with org2 credentials - should fail
      const crossOrgAccess = await getBoatById(org2Id, boat1.id);
      expect(crossOrgAccess).toBeNull();
    });

    it("should soft delete boats", async () => {
      const boat = await createBoat(testOrgId, { name: "Delete Me", capacity: 10 });

      await deleteBoat(testOrgId, boat.id);

      // Boat should still exist in DB but marked inactive
      const { sql } = getDb();
      const result = await sql`SELECT * FROM boats WHERE id = ${boat.id}`;
      expect(result).toHaveLength(1);
      expect(result[0].is_active).toBe(false);
    });
  });

  describe("Customers Queries", () => {
    it("should create and retrieve a customer", async () => {
      const customer = await createCustomer(testOrgId, {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "555-1234",
      });

      expect(customer).toBeDefined();
      expect(customer.email).toBe("test@example.com");
      expect(customer.firstName).toBe("John");

      const retrieved = await getCustomerById(testOrgId, customer.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(customer.id);
    });

    it("should enforce unique email per organization", async () => {
      await createCustomer(testOrgId, {
        email: "unique@test.com",
        firstName: "First",
        lastName: "User",
      });

      // Should throw unique constraint error
      await expect(
        createCustomer(testOrgId, {
          email: "unique@test.com",
          firstName: "Second",
          lastName: "User",
        })
      ).rejects.toThrow();
    });

    it("should allow same email in different organizations", async () => {
      const org1Id = "org-1";
      const org2Id = "org-2";

      const customer1 = await createCustomer(org1Id, {
        email: "shared@test.com",
        firstName: "Org1",
        lastName: "User",
      });

      const customer2 = await createCustomer(org2Id, {
        email: "shared@test.com",
        firstName: "Org2",
        lastName: "User",
      });

      expect(customer1.email).toBe(customer2.email);
      expect(customer1.id).not.toBe(customer2.id);
      expect(customer1.organizationId).not.toBe(customer2.organizationId);
    });

    it("should search customers with getCustomers", async () => {
      await createCustomer(testOrgId, {
        email: "alice@test.com",
        firstName: "Alice",
        lastName: "Johnson",
      });

      await createCustomer(testOrgId, {
        email: "bob@test.com",
        firstName: "Bob",
        lastName: "Smith",
      });

      const { customers } = await getCustomers(testOrgId, { search: "Alice" });
      expect(customers).toHaveLength(1);
      expect(customers[0].firstName).toBe("Alice");
    });

    it("should cascade delete customer bookings", async () => {
      const { sql } = getDb();

      const customer = await createCustomer(testOrgId, {
        email: "cascade@test.com",
        firstName: "Cascade",
        lastName: "Test",
      });

      // Create tour, boat, trip, booking
      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${testOrgId}, 'Tour', 100)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${testOrgId}, 'Boat', 20)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, start_time) VALUES (${testOrgId}, ${tour[0].id}, ${boat[0].id}, '2026-06-15', '09:00')`;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;

      await sql`INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total) VALUES (${testOrgId}, 'CASCADE-001', ${customer.id}, ${trip[0].id}, 2, 200.00)`;

      // Verify booking exists
      let bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customer.id}`;
      expect(bookings).toHaveLength(1);

      // Delete customer
      await deleteCustomer(testOrgId, customer.id);

      // Bookings should be cascade deleted
      bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customer.id}`;
      expect(bookings).toHaveLength(0);
    });
  });

  describe("Bookings Queries", () => {
    let customerId: string;
    let tripId: string;

    beforeEach(async () => {
      const { sql } = getDb();

      // Create test data
      const customer = await createCustomer(testOrgId, {
        email: "booking@test.com",
        firstName: "Booking",
        lastName: "Test",
      });
      customerId = customer.id;

      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${testOrgId}, 'Scuba Tour', 150.00)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${testOrgId}, 'Dive Boat', 20)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, start_time) VALUES (${testOrgId}, ${tour[0].id}, ${boat[0].id}, '2026-07-01', '10:00')`;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      tripId = trip[0].id;
    });

    it("should create and retrieve a booking", async () => {
      const booking = await createBooking(testOrgId, {
        bookingNumber: "BK-001",
        customerId,
        tripId,
        participants: 2,
        total: 300.00,
        status: "confirmed",
      });

      expect(booking).toBeDefined();
      expect(booking.bookingNumber).toBe("BK-001");
      expect(booking.participants).toBe(2);

      const retrieved = await getBookingById(testOrgId, booking.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(booking.id);
    });

    it("should filter bookings by status", async () => {
      await createBooking(testOrgId, {
        bookingNumber: "BK-CONF-1",
        customerId,
        tripId,
        participants: 1,
        total: 150.00,
        status: "confirmed",
      });

      await createBooking(testOrgId, {
        bookingNumber: "BK-PEND-1",
        customerId,
        tripId,
        participants: 1,
        total: 150.00,
        status: "pending",
      });

      const { bookings } = await getBookings(testOrgId, { status: "confirmed" });
      expect(bookings).toHaveLength(1);
      expect(bookings[0].status).toBe("confirmed");
    });

    it("should get recent bookings", async () => {
      await createBooking(testOrgId, {
        bookingNumber: "BK-RECENT-1",
        customerId,
        tripId,
        participants: 1,
        total: 150.00,
      });

      const recentBookings = await getRecentBookings(testOrgId, 5);
      expect(recentBookings.length).toBeGreaterThan(0);
      expect(recentBookings[0]).toHaveProperty("customer");
      expect(recentBookings[0]).toHaveProperty("trip");
    });

    it("should get customer booking history", async () => {
      await createBooking(testOrgId, {
        bookingNumber: "BK-HIST-1",
        customerId,
        tripId,
        participants: 1,
        total: 150.00,
      });

      const history = await getCustomerBookings(testOrgId, customerId);
      expect(history).toHaveLength(1);
      expect(history[0].bookingNumber).toBe("BK-HIST-1");
    });

    it("should enforce multi-tenant isolation for bookings", async () => {
      const org1Id = "org-1";
      const org2Id = "org-2";

      // Create minimal setup for org1
      const org1Customer = await createCustomer(org1Id, {
        email: "org1@test.com",
        firstName: "Org1",
        lastName: "User",
      });

      const { sql } = getDb();
      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${org1Id}, 'Tour', 100)`;
      const tour = await sql`SELECT id FROM tours WHERE organization_id = ${org1Id} LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${org1Id}, 'Boat', 20)`;
      const boat = await sql`SELECT id FROM boats WHERE organization_id = ${org1Id} LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, start_time) VALUES (${org1Id}, ${tour[0].id}, ${boat[0].id}, '2026-08-01', '11:00')`;
      const trip = await sql`SELECT id FROM trips WHERE organization_id = ${org1Id} LIMIT 1`;

      const booking = await createBooking(org1Id, {
        bookingNumber: "ORG1-BK-001",
        customerId: org1Customer.id,
        tripId: trip[0].id,
        participants: 1,
        total: 100.00,
      });

      // Try to access org1's booking from org2 - should fail
      const crossOrgAccess = await getBookingById(org2Id, booking.id);
      expect(crossOrgAccess).toBeNull();
    });
  });

  describe("Database Constraints", () => {
    it("should enforce foreign key constraints", async () => {
      const { sql } = getDb();

      // Try to create booking with non-existent customer
      await expect(
        sql`INSERT INTO bookings (organization_id, booking_number, customer_id, trip_id, participants, total)
            VALUES (${testOrgId}, 'FK-TEST', 'nonexistent-id', 'nonexistent-trip', 1, 100.00)`
      ).rejects.toThrow();
    });

    it("should enforce unique booking numbers", async () => {
      const customer = await createCustomer(testOrgId, {
        email: "unique-booking@test.com",
        firstName: "Unique",
        lastName: "Booking",
      });

      const { sql } = getDb();
      await sql`INSERT INTO tours (organization_id, name, price) VALUES (${testOrgId}, 'Tour', 100)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;

      await sql`INSERT INTO boats (organization_id, name, capacity) VALUES (${testOrgId}, 'Boat', 20)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;

      await sql`INSERT INTO trips (organization_id, tour_id, boat_id, date, start_time) VALUES (${testOrgId}, ${tour[0].id}, ${boat[0].id}, '2026-09-01', '12:00')`;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;

      await createBooking(testOrgId, {
        bookingNumber: "UNIQUE-001",
        customerId: customer.id,
        tripId: trip[0].id,
        participants: 1,
        total: 100.00,
      });

      // Try to create another booking with same number
      await expect(
        createBooking(testOrgId, {
          bookingNumber: "UNIQUE-001",
          customerId: customer.id,
          tripId: trip[0].id,
          participants: 1,
          total: 100.00,
        })
      ).rejects.toThrow();
    });
  });
});
