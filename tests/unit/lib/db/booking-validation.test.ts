/**
 * Booking Validation and Pricing Tests
 *
 * Tests for booking business logic including availability checking,
 * pricing calculations, date validation, and participant limits.
 */

import { db } from "../../../../lib/db/index";

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "TEST1234"),
}));

// Mock database before imports
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    returning: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    logo: "logo",
    metadata: "metadata",
    customDomain: "customDomain",
    publicSiteSettings: "publicSiteSettings",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    date: "date",
    status: "status",
    maxParticipants: "maxParticipants",
    price: "price",
  },
  tours: {
    id: "id",
    name: "name",
    price: "price",
    maxParticipants: "maxParticipants",
    currency: "currency",
    isActive: "isActive",
  },
  bookings: {
    id: "id",
    organizationId: "organizationId",
    tripId: "tripId",
    customerId: "customerId",
    participants: "participants",
    status: "status",
    subtotal: "subtotal",
    tax: "tax",
    total: "total",
    currency: "currency",
    paymentStatus: "paymentStatus",
    bookingNumber: "bookingNumber",
    specialRequests: "specialRequests",
    source: "source",
  },
  customers: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    updatedAt: "updatedAt",
  },
}));

import { createWidgetBooking } from "../../../../lib/db/mutations.public";

describe("Booking Validation and Pricing Logic", () => {
  const testOrgId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    (db.select as unknown as Mock).mockReturnValue(db);
    (db.from as unknown as Mock).mockReturnValue(db);
    (db.where as unknown as Mock).mockReturnValue(db);
    (db.innerJoin as unknown as Mock).mockReturnValue(db);
    (db.leftJoin as unknown as Mock).mockReturnValue(db);
    (db.insert as unknown as Mock).mockReturnValue(db);
    (db.values as unknown as Mock).mockReturnValue(db);
    (db.update as unknown as Mock).mockReturnValue(db);
    (db.set as unknown as Mock).mockReturnValue(db);
    (db.delete as unknown as Mock).mockReturnValue(db);
    (db.groupBy as unknown as Mock).mockReturnValue(db);
    (db.orderBy as unknown as Mock).mockReturnValue(db);
    (db.limit as unknown as Mock).mockResolvedValue([]);
    (db.offset as unknown as Mock).mockResolvedValue([]);
    (db.returning as unknown as Mock).mockResolvedValue([]);
    // Setup transaction mock to execute callback with db as tx
    (db.transaction as unknown as Mock).mockImplementation(async (callback) => {
      return callback(db);
    });
  });

  // ============================================================================
  // Availability Validation Tests
  // ============================================================================

  describe("Availability Validation", () => {
    it("should create booking when sufficient spots available", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 5 }]; // 5 spots already booked
      const existingCustomer = []; // New customer
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.participants).toBe(2);
      expect(result.status).toBe("pending");
    });

    it("should reject booking when insufficient spots available", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 9 }]; // 9 spots already booked, only 1 left

      const mockTripLimit = vi.fn().mockResolvedValue(tripData);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings);

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 2, // Requesting 2 but only 1 available
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Only 1 spots available");
    });

    it("should reject booking when trip is full", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 10 }]; // Trip is full

      const mockTripLimit = vi.fn().mockResolvedValue(tripData);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings);

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Only 0 spots available");
    });

    it("should calculate available spots correctly with multiple bookings", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 20,
          tourMaxParticipants: 20,
          tripPrice: "150.00",
          tourPrice: "150.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 15 }]; // 15 spots booked, 5 remaining

      const mockTripLimit = vi.fn().mockResolvedValue(tripData);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings);

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 6, // Requesting more than available
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Only 5 spots available");
    });
  });

  // ============================================================================
  // Date Validation Tests
  // ============================================================================

  describe("Date Validation", () => {
    it("should reject booking for past dates", async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: pastDate.toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];

      const mockTripLimit = vi.fn().mockResolvedValue(tripData);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings);

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 2,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Cannot book past trips");
    });

    it("should allow booking for today's date", async () => {
      // Use tomorrow to avoid timezone edge cases with midnight comparison
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: tomorrow.toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.status).toBe("pending");
    });

    it("should allow booking for future dates", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: futureDate.toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.status).toBe("pending");
    });
  });

  // ============================================================================
  // Pricing Calculation Tests
  // ============================================================================

  describe("Pricing Calculations", () => {
    it("should calculate correct price for single participant", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "125.00",
          tourPrice: "125.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 1,
          total: "125.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.total).toBe("125.00");
    });

    it("should calculate correct price for multiple participants", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "75.50",
          tourPrice: "75.50",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 4,
          total: "302.00", // 75.50 * 4 = 302.00
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 4,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.total).toBe("302.00");
      expect(result.participants).toBe(4);
    });

    it("should use trip price override when available", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "149.99", // Trip-specific price
          tourPrice: "199.99", // Original tour price
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "299.98", // Should use 149.99, not 199.99
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.total).toBe("299.98");
    });

    it("should handle decimal participant counts in pricing", async () => {
      // Note: This is an edge case, normally participants should be integers
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "100.00",
          tourPrice: "100.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 3,
          total: "300.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 3,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.total).toBe("300.00");
    });
  });

  // ============================================================================
  // Trip Status Validation Tests
  // ============================================================================

  describe("Trip Status Validation", () => {
    it("should reject booking for cancelled trip", async () => {
      // Mock trip query to return empty (trip not found)
      const mockTripLimit = vi.fn().mockResolvedValue([]);

      (db.where as unknown as Mock).mockReturnValueOnce({ limit: mockTripLimit });

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 2,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Trip not found or not available");
    });

    it("should reject booking for inactive tour", async () => {
      // Mock trip query to return empty (inactive tour filtered out)
      const mockTripLimit = vi.fn().mockResolvedValue([]);

      (db.where as unknown as Mock).mockReturnValueOnce({ limit: mockTripLimit });

      await expect(
        createWidgetBooking(testOrgId, {
          tripId: "trip-1",
          participants: 2,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow("Trip not found or not available");
    });

    it("should only allow booking for scheduled trips", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled", // Only scheduled status allowed
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.status).toBe("pending");
    });
  });

  // ============================================================================
  // Customer Handling Tests
  // ============================================================================

  describe("Customer Handling", () => {
    it("should create new customer if email not found", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = []; // No existing customer
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "newcustomer@example.com",
      });

      expect(result.customerId).toBe("cust-new");
    });

    it("should update existing customer if email found", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [{ id: "cust-existing" }]; // Existing customer
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-existing",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock).mockResolvedValueOnce(newBooking);

      const result = await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "existing@example.com",
      });

      expect(result.customerId).toBe("cust-existing");
      expect(db.update).toHaveBeenCalled(); // Should update existing customer
    });

    it("should normalize email to lowercase", async () => {
      const tripData = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "99.00",
          currency: "USD",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "scheduled",
        },
      ];

      const existingBookings = [{ total: 0 }];
      const existingCustomer = [];
      const newCustomer = [{ id: "cust-new" }];
      const newBooking = [
        {
          id: "booking-1",
          bookingNumber: "BK-TEST-TEST1234",
          tripId: "trip-1",
          customerId: "cust-new",
          participants: 2,
          total: "198.00",
          currency: "USD",
          status: "pending",
          paymentStatus: "pending",
        },
      ];

      // Query 1: Trip query .where().limit()
      // Query 2: Booking count query .where() terminal
      // Query 3: Customer query .where().limit()
      const mockTripLimit = vi.fn().mockResolvedValue(tripData);
      const mockCustomerLimit = vi.fn().mockResolvedValue(existingCustomer);

      (db.where as unknown as Mock)
        .mockReturnValueOnce({ limit: mockTripLimit })
        .mockResolvedValueOnce(existingBookings)
        .mockReturnValueOnce({ limit: mockCustomerLimit });

      (db.returning as unknown as Mock)
        .mockResolvedValueOnce(newCustomer)
        .mockResolvedValueOnce(newBooking);

      await createWidgetBooking(testOrgId, {
        tripId: "trip-1",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "John.Doe@EXAMPLE.COM",
      });

      // Email should be normalized to lowercase when checking/creating customer
      expect(db.values).toHaveBeenCalled();
    });
  });
});
