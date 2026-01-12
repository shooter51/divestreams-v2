import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testCustomers,
  testDiveSites,
  testBoats,
  testTours,
  testTrips,
  testBookings,
  testTenant,
} from "../../../fixtures/test-data";

// Mock postgres module
const mockClient = {
  unsafe: vi.fn(),
  end: vi.fn(),
};

vi.mock("postgres", () => ({
  default: vi.fn(() => mockClient),
}));

// Import after mocks
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBookings,
  getTours,
  getTourById,
  createTour,
  getTrips,
  getTripById,
  createTrip,
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  getEquipment,
  getEquipmentById,
  createEquipment,
  getBoats,
  getBoatById,
  createBoat,
  getDiveSites,
  getDiveSiteById,
  createDiveSite,
  getDashboardStats,
  getUpcomingTrips,
  getRecentBookings,
} from "../../../../lib/db/queries.server";

const SCHEMA_NAME = "tenant_testshop";

describe("Queries Server Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // getCustomers Tests
  // ============================================================================

  describe("getCustomers", () => {
    it("should return customers with default pagination", async () => {
      const mockCustomers = [
        {
          id: "uuid-1",
          email: "john@example.com",
          first_name: "John",
          last_name: "Doe",
          phone: "+1-555-0101",
        },
        {
          id: "uuid-2",
          email: "sarah@example.com",
          first_name: "Sarah",
          last_name: "Smith",
          phone: "+1-555-0201",
        },
      ];

      mockClient.unsafe
        .mockResolvedValueOnce(mockCustomers)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await getCustomers(SCHEMA_NAME);

      expect(result.customers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.customers[0].firstName).toBe("John");
      expect(mockClient.end).toHaveBeenCalled();
    });

    it("should return empty array when no customers exist", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await getCustomers(SCHEMA_NAME);

      expect(result.customers).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should filter customers by search term", async () => {
      const mockCustomers = [
        {
          id: "uuid-1",
          email: "john@example.com",
          first_name: "John",
          last_name: "Doe",
        },
      ];

      mockClient.unsafe
        .mockResolvedValueOnce(mockCustomers)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await getCustomers(SCHEMA_NAME, { search: "john" });

      expect(result.customers).toHaveLength(1);
      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE")
      );
    });

    it("should apply custom limit and offset", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await getCustomers(SCHEMA_NAME, { limit: 10, offset: 20 });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 10 OFFSET 20")
      );
    });

    it("should escape single quotes in search term", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await getCustomers(SCHEMA_NAME, { search: "O'Brien" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("O''Brien")
      );
    });
  });

  // ============================================================================
  // getCustomerById Tests
  // ============================================================================

  describe("getCustomerById", () => {
    it("should return customer when found", async () => {
      const mockCustomer = {
        id: "uuid-1",
        email: "john@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: "+1-555-0101",
        date_of_birth: "1990-01-01",
        emergency_contact_name: "Jane Doe",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockCustomer]);

      const result = await getCustomerById(SCHEMA_NAME, "uuid-1");

      expect(result).not.toBeNull();
      expect(result?.firstName).toBe("John");
      expect(result?.lastName).toBe("Doe");
      expect(result?.emergencyContactName).toBe("Jane Doe");
    });

    it("should return null when customer not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getCustomerById(SCHEMA_NAME, "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createCustomer Tests
  // ============================================================================

  describe("createCustomer", () => {
    it("should create customer with required fields", async () => {
      const mockCustomer = {
        id: "new-uuid",
        email: "new@example.com",
        first_name: "New",
        last_name: "Customer",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockCustomer]);

      const result = await createCustomer(SCHEMA_NAME, {
        email: "new@example.com",
        firstName: "New",
        lastName: "Customer",
      });

      expect(result.email).toBe("new@example.com");
      expect(result.firstName).toBe("New");
    });

    it("should create customer with all optional fields", async () => {
      const mockCustomer = {
        id: "new-uuid",
        email: "full@example.com",
        first_name: "Full",
        last_name: "Customer",
        phone: "+1-555-0000",
        date_of_birth: "1985-05-15",
        emergency_contact_name: "Emergency Contact",
        medical_conditions: "None",
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postal_code: "33101",
        country: "USA",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockCustomer]);

      const result = await createCustomer(SCHEMA_NAME, {
        email: "full@example.com",
        firstName: "Full",
        lastName: "Customer",
        phone: "+1-555-0000",
        dateOfBirth: "1985-05-15",
        emergencyContactName: "Emergency Contact",
        medicalConditions: "None",
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
      });

      expect(result.city).toBe("Miami");
      expect(result.state).toBe("FL");
    });
  });

  // ============================================================================
  // updateCustomer Tests
  // ============================================================================

  describe("updateCustomer", () => {
    it("should update customer email", async () => {
      const mockCustomer = {
        id: "uuid-1",
        email: "updated@example.com",
        first_name: "John",
        last_name: "Doe",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockCustomer]);

      const result = await updateCustomer(SCHEMA_NAME, "uuid-1", {
        email: "updated@example.com",
      });

      expect(result?.email).toBe("updated@example.com");
    });

    it("should return null when customer not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await updateCustomer(SCHEMA_NAME, "nonexistent", {
        email: "new@example.com",
      });

      expect(result).toBeNull();
    });

    it("should update multiple fields", async () => {
      const mockCustomer = {
        id: "uuid-1",
        email: "updated@example.com",
        first_name: "Updated",
        last_name: "Name",
        phone: "+1-555-9999",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockCustomer]);

      const result = await updateCustomer(SCHEMA_NAME, "uuid-1", {
        email: "updated@example.com",
        firstName: "Updated",
        lastName: "Name",
        phone: "+1-555-9999",
      });

      expect(result?.firstName).toBe("Updated");
      expect(result?.phone).toBe("+1-555-9999");
    });
  });

  // ============================================================================
  // deleteCustomer Tests
  // ============================================================================

  describe("deleteCustomer", () => {
    it("should delete customer and return true", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await deleteCustomer(SCHEMA_NAME, "uuid-1");

      expect(result).toBe(true);
      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM")
      );
    });
  });

  // ============================================================================
  // getTours Tests
  // ============================================================================

  describe("getTours", () => {
    it("should return all tours", async () => {
      const mockTours = [
        {
          id: "tour-1",
          name: "Beginner Dive",
          type: "single_dive",
          price: "99.00",
          max_participants: 6,
          is_active: true,
          trip_count: 5,
        },
        {
          id: "tour-2",
          name: "Advanced Reef",
          type: "multi_dive",
          price: "149.00",
          max_participants: 8,
          is_active: true,
          trip_count: 10,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockTours);

      const result = await getTours(SCHEMA_NAME);

      expect(result).toHaveLength(2);
      expect(result[0].tripCount).toBe(5);
    });

    it("should filter active tours only", async () => {
      const mockTours = [
        {
          id: "tour-1",
          name: "Active Tour",
          type: "single_dive",
          price: "99.00",
          max_participants: 6,
          is_active: true,
          trip_count: 5,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockTours);

      await getTours(SCHEMA_NAME, { activeOnly: true });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true")
      );
    });

    it("should filter tours by search term", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getTours(SCHEMA_NAME, { search: "beginner" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE")
      );
    });

    it("should filter tours by type", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getTours(SCHEMA_NAME, { type: "multi_dive" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("type = 'multi_dive'")
      );
    });

    it("should return empty array when no tours exist", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getTours(SCHEMA_NAME);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // getTourById Tests
  // ============================================================================

  describe("getTourById", () => {
    it("should return tour when found", async () => {
      const mockTour = {
        id: "tour-1",
        name: "Beginner Dive",
        type: "single_dive",
        price: "99.00",
        max_participants: 6,
        min_participants: 1,
        includes_equipment: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockTour]);

      const result = await getTourById(SCHEMA_NAME, "tour-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Beginner Dive");
      expect(result?.includesEquipment).toBe(true);
    });

    it("should return null when tour not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getTourById(SCHEMA_NAME, "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getTrips Tests
  // ============================================================================

  describe("getTrips", () => {
    it("should return trips with joined data", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          tour_id: "tour-1",
          boat_id: "boat-1",
          date: "2025-02-01",
          start_time: "09:00",
          status: "scheduled",
          tour_name: "Beginner Dive",
          tour_type: "single_dive",
          boat_name: "Sea Explorer",
          booked_participants: 4,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockTrips);

      const result = await getTrips(SCHEMA_NAME);

      expect(result).toHaveLength(1);
      expect(result[0].tourName).toBe("Beginner Dive");
      expect(result[0].boatName).toBe("Sea Explorer");
      expect(result[0].bookedParticipants).toBe(4);
    });

    it("should filter trips by date range", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getTrips(SCHEMA_NAME, {
        fromDate: "2025-02-01",
        toDate: "2025-02-28",
      });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("date >= '2025-02-01'")
      );
      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("date <= '2025-02-28'")
      );
    });

    it("should filter trips by status", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getTrips(SCHEMA_NAME, { status: "scheduled" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'scheduled'")
      );
    });

    it("should apply custom limit", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getTrips(SCHEMA_NAME, { limit: 10 });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 10")
      );
    });
  });

  // ============================================================================
  // getBookings Tests
  // ============================================================================

  describe("getBookings", () => {
    it("should return bookings with joined customer and trip data", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          booking_number: "BK-001",
          trip_id: "trip-1",
          customer_id: "customer-1",
          participants: 2,
          status: "confirmed",
          subtotal: "198.00",
          total: "198.00",
          first_name: "John",
          last_name: "Doe",
          customer_email: "john@example.com",
          tour_name: "Beginner Dive",
          trip_date: "2025-02-01",
          trip_time: "09:00",
        },
      ];

      mockClient.unsafe
        .mockResolvedValueOnce(mockBookings)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await getBookings(SCHEMA_NAME);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].customerFirstName).toBe("John");
      expect(result.bookings[0].tourName).toBe("Beginner Dive");
      expect(result.total).toBe(1);
    });

    it("should filter bookings by status", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await getBookings(SCHEMA_NAME, { status: "confirmed" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'confirmed'")
      );
    });

    it("should filter bookings by tripId", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await getBookings(SCHEMA_NAME, { tripId: "trip-1" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("trip_id = 'trip-1'")
      );
    });

    it("should filter bookings by customerId", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await getBookings(SCHEMA_NAME, { customerId: "customer-1" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("customer_id = 'customer-1'")
      );
    });

    it("should return empty results when no bookings exist", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await getBookings(SCHEMA_NAME);

      expect(result.bookings).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================================
  // getBookingById Tests
  // ============================================================================

  describe("getBookingById", () => {
    it("should return booking with full details", async () => {
      const mockBooking = {
        id: "booking-1",
        booking_number: "BK-001",
        trip_id: "trip-1",
        customer_id: "customer-1",
        participants: 2,
        status: "confirmed",
        subtotal: "198.00",
        discount: "0.00",
        tax: "10.00",
        total: "208.00",
        currency: "USD",
        payment_status: "paid",
        first_name: "John",
        last_name: "Doe",
        customer_email: "john@example.com",
        tour_name: "Beginner Dive",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBooking]);

      const result = await getBookingById(SCHEMA_NAME, "booking-1");

      expect(result).not.toBeNull();
      expect(result?.bookingNumber).toBe("BK-001");
      expect(result?.total).toBe(208);
      expect(result?.paymentStatus).toBe("paid");
    });

    it("should return null when booking not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getBookingById(SCHEMA_NAME, "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createBooking Tests
  // ============================================================================

  describe("createBooking", () => {
    it("should create booking with generated booking number", async () => {
      const mockBooking = {
        id: "new-booking",
        booking_number: "BK12345",
        trip_id: "trip-1",
        customer_id: "customer-1",
        participants: 1,
        subtotal: "99.00",
        total: "99.00",
        status: "pending",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBooking]);

      const result = await createBooking(SCHEMA_NAME, {
        tripId: "trip-1",
        customerId: "customer-1",
        subtotal: 99,
        total: 99,
      });

      expect(result.booking_number).toBeDefined();
      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO")
      );
    });

    it("should create booking with discount and tax", async () => {
      const mockBooking = {
        id: "new-booking",
        booking_number: "BK12345",
        subtotal: "200.00",
        discount: "20.00",
        tax: "18.00",
        total: "198.00",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBooking]);

      await createBooking(SCHEMA_NAME, {
        tripId: "trip-1",
        customerId: "customer-1",
        subtotal: 200,
        discount: 20,
        tax: 18,
        total: 198,
      });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("20")
      );
    });
  });

  // ============================================================================
  // updateBookingStatus Tests
  // ============================================================================

  describe("updateBookingStatus", () => {
    it("should update booking status", async () => {
      const mockBooking = {
        id: "booking-1",
        status: "confirmed",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBooking]);

      const result = await updateBookingStatus(SCHEMA_NAME, "booking-1", "confirmed");

      expect(result.status).toBe("confirmed");
    });
  });

  // ============================================================================
  // getEquipment Tests
  // ============================================================================

  describe("getEquipment", () => {
    it("should return all equipment", async () => {
      const mockEquipment = [
        {
          id: "equip-1",
          category: "bcd",
          name: "BCD Large",
          status: "available",
          rental_price: "25.00",
          is_rentable: true,
        },
        {
          id: "equip-2",
          category: "regulator",
          name: "Regulator Set",
          status: "available",
          rental_price: "30.00",
          is_rentable: true,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockEquipment);

      const result = await getEquipment(SCHEMA_NAME);

      expect(result).toHaveLength(2);
      expect(result[0].rentalPrice).toBe(25);
    });

    it("should filter equipment by category", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getEquipment(SCHEMA_NAME, { category: "bcd" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("category = 'bcd'")
      );
    });

    it("should filter equipment by status", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getEquipment(SCHEMA_NAME, { status: "available" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'available'")
      );
    });

    it("should filter equipment by search term", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getEquipment(SCHEMA_NAME, { search: "large" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE")
      );
    });
  });

  // ============================================================================
  // getBoats Tests
  // ============================================================================

  describe("getBoats", () => {
    it("should return all boats with trip count", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Sea Explorer",
          capacity: 12,
          is_active: true,
          trip_count: 15,
        },
        {
          id: "boat-2",
          name: "Ocean Rider",
          capacity: 8,
          is_active: true,
          trip_count: 8,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockBoats);

      const result = await getBoats(SCHEMA_NAME);

      expect(result).toHaveLength(2);
      expect(result[0].tripCount).toBe(15);
    });

    it("should filter active boats only", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getBoats(SCHEMA_NAME, { activeOnly: true });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true")
      );
    });

    it("should filter boats by search term", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getBoats(SCHEMA_NAME, { search: "explorer" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE")
      );
    });
  });

  // ============================================================================
  // getBoatById Tests
  // ============================================================================

  describe("getBoatById", () => {
    it("should return boat when found", async () => {
      const mockBoat = {
        id: "boat-1",
        name: "Sea Explorer",
        description: "Comfortable dive boat",
        capacity: 12,
        type: "catamaran",
        registration_number: "FL-1234",
        is_active: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBoat]);

      const result = await getBoatById(SCHEMA_NAME, "boat-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Sea Explorer");
      expect(result?.capacity).toBe(12);
    });

    it("should return null when boat not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getBoatById(SCHEMA_NAME, "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getDiveSites Tests
  // ============================================================================

  describe("getDiveSites", () => {
    it("should return all dive sites", async () => {
      const mockSites = [
        {
          id: "site-1",
          name: "Coral Paradise",
          description: "Beautiful coral reef",
          max_depth: 25,
          difficulty: "beginner",
          is_active: true,
        },
        {
          id: "site-2",
          name: "Wreck of Neptune",
          description: "Historic shipwreck",
          max_depth: 40,
          difficulty: "advanced",
          is_active: true,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockSites);

      const result = await getDiveSites(SCHEMA_NAME);

      expect(result).toHaveLength(2);
      expect(result[0].maxDepth).toBe(25);
    });

    it("should filter active dive sites only", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getDiveSites(SCHEMA_NAME, { activeOnly: true });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true")
      );
    });

    it("should filter dive sites by difficulty", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getDiveSites(SCHEMA_NAME, { difficulty: "advanced" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("difficulty = 'advanced'")
      );
    });

    it("should filter dive sites by search term", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getDiveSites(SCHEMA_NAME, { search: "coral" });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE")
      );
    });
  });

  // ============================================================================
  // getDiveSiteById Tests
  // ============================================================================

  describe("getDiveSiteById", () => {
    it("should return dive site when found", async () => {
      const mockSite = {
        id: "site-1",
        name: "Coral Paradise",
        description: "Beautiful coral reef",
        latitude: "25.7617000",
        longitude: "-80.1918000",
        max_depth: 25,
        min_depth: 5,
        difficulty: "beginner",
        current_strength: "mild",
        visibility: "excellent",
        is_active: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockSite]);

      const result = await getDiveSiteById(SCHEMA_NAME, "site-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Coral Paradise");
      expect(result?.latitude).toBe(25.7617);
      expect(result?.longitude).toBe(-80.1918);
    });

    it("should return null when dive site not found", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getDiveSiteById(SCHEMA_NAME, "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getDashboardStats Tests
  // ============================================================================

  describe("getDashboardStats", () => {
    it("should return dashboard statistics", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([{ count: 5 }]) // today's bookings
        .mockResolvedValueOnce([{ total: 1500 }]) // week revenue
        .mockResolvedValueOnce([{ count: 3 }]) // active trips
        .mockResolvedValueOnce([{ count: 100 }]); // total customers

      const result = await getDashboardStats(SCHEMA_NAME);

      expect(result.todayBookings).toBe(5);
      expect(result.weekRevenue).toBe(1500);
      expect(result.activeTrips).toBe(3);
      expect(result.totalCustomers).toBe(100);
    });

    it("should handle null/empty values", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ total: null }])
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ count: null }]);

      const result = await getDashboardStats(SCHEMA_NAME);

      expect(result.todayBookings).toBe(0);
      expect(result.weekRevenue).toBe(0);
      expect(result.activeTrips).toBe(0);
      expect(result.totalCustomers).toBe(0);
    });

    it("should handle empty result arrays", async () => {
      mockClient.unsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getDashboardStats(SCHEMA_NAME);

      expect(result.todayBookings).toBe(0);
      expect(result.weekRevenue).toBe(0);
    });
  });

  // ============================================================================
  // getUpcomingTrips Tests
  // ============================================================================

  describe("getUpcomingTrips", () => {
    it("should return upcoming trips with formatted data", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          name: "Morning Dive",
          date: "2025-03-15",
          start_time: "09:00",
          max_participants: 8,
          current_participants: 4,
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockTrips);

      const result = await getUpcomingTrips(SCHEMA_NAME);

      expect(result).toHaveLength(1);
      // Date formatting returns relative date or formatted date string
      expect(result[0].date).toBeDefined();
      expect(result[0].time).toBe("9:00 AM");
      expect(result[0].participants).toBe(4);
      expect(result[0].maxParticipants).toBe(8);
    });

    it("should apply custom limit", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getUpcomingTrips(SCHEMA_NAME, 10);

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 10")
      );
    });
  });

  // ============================================================================
  // getRecentBookings Tests
  // ============================================================================

  describe("getRecentBookings", () => {
    it("should return recent bookings with customer and trip info", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "198.00",
          created_at: new Date().toISOString(),
          first_name: "John",
          last_name: "Doe",
          trip_name: "Beginner Dive",
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockBookings);

      const result = await getRecentBookings(SCHEMA_NAME);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe("John Doe");
      expect(result[0].trip).toBe("Beginner Dive");
      expect(result[0].amount).toBe(198);
    });

    it("should apply custom limit", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getRecentBookings(SCHEMA_NAME, 10);

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 10")
      );
    });
  });

  // ============================================================================
  // getCustomerBookings Tests
  // ============================================================================

  describe("getCustomerBookings", () => {
    it("should return bookings for a specific customer", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          booking_number: "BK-001",
          status: "confirmed",
          total: "198.00",
          trip_name: "Beginner Dive",
          trip_date: "2025-02-01",
        },
        {
          id: "booking-2",
          booking_number: "BK-002",
          status: "completed",
          total: "149.00",
          trip_name: "Advanced Reef",
          trip_date: "2025-01-15",
        },
      ];

      mockClient.unsafe.mockResolvedValueOnce(mockBookings);

      const result = await getCustomerBookings(SCHEMA_NAME, "customer-1");

      expect(result).toHaveLength(2);
      expect(result[0].bookingNumber).toBe("BK-001");
      expect(result[0].total).toBe("198.00");
    });

    it("should apply custom limit", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      await getCustomerBookings(SCHEMA_NAME, "customer-1", 5);

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 5")
      );
    });

    it("should return empty array when customer has no bookings", async () => {
      mockClient.unsafe.mockResolvedValueOnce([]);

      const result = await getCustomerBookings(SCHEMA_NAME, "customer-no-bookings");

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should throw error when DATABASE_URL is not set", async () => {
      delete process.env.DATABASE_URL;

      await expect(getCustomers(SCHEMA_NAME)).rejects.toThrow(
        "DATABASE_URL not set"
      );
    });

    it("should always close database connection", async () => {
      mockClient.unsafe.mockRejectedValueOnce(new Error("DB Error"));

      try {
        await getCustomerById(SCHEMA_NAME, "test");
      } catch {
        // Expected to throw
      }

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // createTour Tests
  // ============================================================================

  describe("createTour", () => {
    it("should create tour with required fields", async () => {
      const mockTour = {
        id: "new-tour",
        name: "New Tour",
        type: "single_dive",
        price: "99.00",
        max_participants: 8,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockTour]);

      const result = await createTour(SCHEMA_NAME, {
        name: "New Tour",
        type: "single_dive",
        price: 99,
        maxParticipants: 8,
      });

      expect(result.name).toBe("New Tour");
      expect(result.price).toBe(99);
    });
  });

  // ============================================================================
  // createTrip Tests
  // ============================================================================

  describe("createTrip", () => {
    it("should create trip with required fields", async () => {
      const mockTrip = {
        id: "new-trip",
        tour_id: "tour-1",
        date: "2025-02-15",
        start_time: "09:00",
        status: "scheduled",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockTrip]);

      const result = await createTrip(SCHEMA_NAME, {
        tourId: "tour-1",
        date: "2025-02-15",
        startTime: "09:00",
      });

      expect(result.tour_id).toBe("tour-1");
      expect(result.date).toBe("2025-02-15");
    });

    it("should create trip with optional boat and notes", async () => {
      const mockTrip = {
        id: "new-trip",
        tour_id: "tour-1",
        boat_id: "boat-1",
        date: "2025-02-15",
        start_time: "09:00",
        notes: "Special trip",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockTrip]);

      await createTrip(SCHEMA_NAME, {
        tourId: "tour-1",
        boatId: "boat-1",
        date: "2025-02-15",
        startTime: "09:00",
        notes: "Special trip",
      });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("boat-1")
      );
    });
  });

  // ============================================================================
  // createEquipment Tests
  // ============================================================================

  describe("createEquipment", () => {
    it("should create equipment with required fields", async () => {
      const mockEquipment = {
        id: "new-equip",
        category: "bcd",
        name: "BCD XL",
        status: "available",
        condition: "good",
        is_rentable: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockEquipment]);

      const result = await createEquipment(SCHEMA_NAME, {
        category: "bcd",
        name: "BCD XL",
      });

      expect(result.category).toBe("bcd");
      expect(result.status).toBe("available");
    });

    it("should create equipment with all optional fields", async () => {
      const mockEquipment = {
        id: "new-equip",
        category: "regulator",
        name: "Regulator Pro",
        brand: "Scubapro",
        model: "MK25",
        serial_number: "SN12345",
        size: "M",
        status: "maintenance",
        condition: "fair",
        rental_price: "35.00",
        is_rentable: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockEquipment]);

      await createEquipment(SCHEMA_NAME, {
        category: "regulator",
        name: "Regulator Pro",
        brand: "Scubapro",
        model: "MK25",
        serialNumber: "SN12345",
        size: "M",
        status: "maintenance",
        condition: "fair",
        rentalPrice: 35,
      });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("Scubapro")
      );
    });
  });

  // ============================================================================
  // createBoat Tests
  // ============================================================================

  describe("createBoat", () => {
    it("should create boat with required fields", async () => {
      const mockBoat = {
        id: "new-boat",
        name: "New Boat",
        capacity: 10,
        is_active: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockBoat]);

      const result = await createBoat(SCHEMA_NAME, {
        name: "New Boat",
        capacity: 10,
      });

      expect(result.name).toBe("New Boat");
      expect(result.capacity).toBe(10);
    });
  });

  // ============================================================================
  // createDiveSite Tests
  // ============================================================================

  describe("createDiveSite", () => {
    it("should create dive site with required fields", async () => {
      const mockSite = {
        id: "new-site",
        name: "New Dive Site",
        is_active: true,
      };

      mockClient.unsafe.mockResolvedValueOnce([mockSite]);

      const result = await createDiveSite(SCHEMA_NAME, {
        name: "New Dive Site",
      });

      expect(result.name).toBe("New Dive Site");
    });

    it("should create dive site with coordinates", async () => {
      const mockSite = {
        id: "new-site",
        name: "GPS Site",
        latitude: "25.7617000",
        longitude: "-80.1918000",
        max_depth: 30,
        difficulty: "intermediate",
      };

      mockClient.unsafe.mockResolvedValueOnce([mockSite]);

      await createDiveSite(SCHEMA_NAME, {
        name: "GPS Site",
        latitude: 25.7617,
        longitude: -80.1918,
        maxDepth: 30,
        difficulty: "intermediate",
      });

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("25.7617")
      );
    });
  });
});
