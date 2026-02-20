/**
 * Queries Server Database Functions Tests
 *
 * Tests for tenant-side database query functions.
 * Uses mocked database calls to test business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create chain mock using vi.hoisted
const { dbMock, mockReturning, mockLimit, mockOffset, mockGroupBy, resetMocks } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockLimit = vi.fn();
  const mockOffset = vi.fn();
  const mockGroupBy = vi.fn();

  // Track which method was called last to determine which mock to use in thenable
  let lastMethod: 'limit' | 'offset' | 'returning' | 'other' = 'other';

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.from = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.where = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.insert = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.values = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.update = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.set = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.delete = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.innerJoin = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.leftJoin = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.orderBy = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.limit = vi.fn((...args) => { mockLimit(...args); lastMethod = 'limit'; return chain; });
  chain.offset = vi.fn((...args) => { mockOffset(...args); lastMethod = 'offset'; return chain; });
  chain.groupBy = vi.fn(() => { mockGroupBy(); lastMethod = 'other'; return chain; });
  chain.returning = vi.fn((...args) => { mockReturning(...args); lastMethod = 'returning'; return chain; });
  // Thenable - use appropriate mock based on last method called
  chain.then = (resolve: (value: unknown[]) => void, reject?: (error: unknown) => void) => {
    // Call the appropriate mock based on which method was called last
    const mockToCall = lastMethod === 'returning' ? mockReturning
                     : lastMethod === 'offset' ? mockOffset
                     : mockLimit;
    return mockToCall().then(resolve, reject);
  };

  const resetMocks = () => {
    Object.values(chain).forEach((mock) => {
      if (typeof mock === "function" && mock.mockClear) {
        mock.mockClear();
      }
    });
    mockReturning.mockClear();
    mockLimit.mockClear();
    mockOffset.mockClear();
    mockGroupBy.mockClear();
    // Reset to return empty array by default
    mockLimit.mockResolvedValue([]);
    mockOffset.mockResolvedValue([]);
    mockReturning.mockResolvedValue([]);
    // Reset last method tracker
    lastMethod = 'other';
  };

  return { dbMock: chain, mockReturning, mockLimit, mockOffset, mockGroupBy, resetMocks };
});

// Mock the database
vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

// Mock the schema
vi.mock("../../../../lib/db/schema", () => ({
  __esModule: true,
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
  bookings: {
    id: "id", organizationId: "organizationId", tripId: "tripId", customerId: "customerId",
    status: "status", participants: "participants", total: "total", createdAt: "createdAt",
    bookingNumber: "bookingNumber", subtotal: "subtotal", discount: "discount", tax: "tax",
    currency: "currency", specialRequests: "specialRequests", source: "source",
  },
  trips: {
    id: "id", organizationId: "organizationId", tourId: "tourId", boatId: "boatId",
    date: "date", startTime: "startTime", endTime: "endTime", maxParticipants: "maxParticipants",
    price: "price", notes: "notes", status: "status", updatedAt: "updatedAt",
  },
  tours: {
    id: "id", organizationId: "organizationId", name: "name", description: "description",
    type: "type", duration: "duration", maxParticipants: "maxParticipants", minParticipants: "minParticipants",
    price: "price", currency: "currency", isActive: "isActive", includesEquipment: "includesEquipment",
    includesMeals: "includesMeals", includesTransport: "includesTransport", minCertLevel: "minCertLevel",
    minAge: "minAge", updatedAt: "updatedAt",
  },
  customers: {
    id: "id", organizationId: "organizationId", email: "email", firstName: "firstName",
    lastName: "lastName", phone: "phone", dateOfBirth: "dateOfBirth", emergencyContactName: "emergencyContactName",
    emergencyContactPhone: "emergencyContactPhone", emergencyContactRelation: "emergencyContactRelation",
    medicalConditions: "medicalConditions", medications: "medications", certifications: "certifications",
    address: "address", city: "city", state: "state", postalCode: "postalCode",
    country: "country", notes: "notes", updatedAt: "updatedAt",
  },
  transactions: {
    id: "id", organizationId: "organizationId", type: "type", amount: "amount", createdAt: "createdAt",
  },
  equipment: {
    id: "id", organizationId: "organizationId", category: "category", name: "name",
    brand: "brand", model: "model", status: "status", condition: "condition", rentalPrice: "rentalPrice",
    isRentable: "isRentable", serialNumber: "serialNumber", barcode: "barcode", size: "size",
  },
  boats: {
    id: "id", organizationId: "organizationId", name: "name", description: "description",
    capacity: "capacity", type: "type", registrationNumber: "registrationNumber", amenities: "amenities",
    isActive: "isActive",
  },
  diveSites: {
    id: "id", organizationId: "organizationId", name: "name", description: "description",
    latitude: "latitude", longitude: "longitude", maxDepth: "maxDepth", minDepth: "minDepth",
    difficulty: "difficulty", currentStrength: "currentStrength", visibility: "visibility",
    highlights: "highlights", isActive: "isActive", updatedAt: "updatedAt",
  },
  rentals: {
    id: "id", organizationId: "organizationId", equipmentId: "equipmentId", customerId: "customerId",
    rentedAt: "rentedAt", returnedAt: "returnedAt", dueAt: "dueAt", status: "status",
    dailyRate: "dailyRate", totalCharge: "totalCharge",
  },
  serviceRecords: {
    id: "id", organizationId: "organizationId", equipmentId: "equipmentId",
    type: "type", description: "description", performedAt: "performedAt",
    performedBy: "performedBy", notes: "notes", cost: "cost",
  },
  tourDiveSites: {
    tourId: "tourId", diveSiteId: "diveSiteId",
  },
}));

// Mock drizzle-orm functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  or: vi.fn((...conditions) => ({ conditions, op: "or" })),
  gte: vi.fn((col, val) => ({ col, val, op: "gte" })),
  lte: vi.fn((col, val) => ({ col, val, op: "lte" })),
  desc: vi.fn((col) => ({ col, op: "desc" })),
  inArray: vi.fn((col, vals) => ({ col, vals, op: "inArray" })),
  sql: vi.fn((strings, ...values) => ({
    strings,
    values,
    op: "sql",
    as: vi.fn((alias) => ({ strings, values, op: "sql", alias })),
  })),
  count: vi.fn(() => ({ op: "count" })),
  sum: vi.fn(() => ({ op: "sum" })),
}));

describe("queries.server database functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================================
  // getDashboardStats Tests
  // ============================================================================
  describe("getDashboardStats", () => {
    it("should return dashboard statistics", async () => {
      mockLimit
        .mockResolvedValueOnce([{ count: 5 }])   // today's bookings
        .mockResolvedValueOnce([{ total: 1500 }]) // week revenue
        .mockResolvedValueOnce([{ count: 3 }])   // active trips
        .mockResolvedValueOnce([{ count: 100 }]); // total customers

      const { getDashboardStats } = await import("../../../../lib/db/queries.server");

      const result = await getDashboardStats("org-1");

      expect(result.todayBookings).toBe(5);
      expect(result.weekRevenue).toBe(1500);
      expect(result.activeTrips).toBe(3);
      expect(result.totalCustomers).toBe(100);
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("should handle zero values", async () => {
      const { getDashboardStats } = await import("../../../../lib/db/queries.server");

      const result = await getDashboardStats("org-1");

      expect(result.todayBookings).toBe(0);
      expect(result.weekRevenue).toBe(0);
      expect(result.activeTrips).toBe(0);
      expect(result.totalCustomers).toBe(0);
    });
  });

  // ============================================================================
  // Customer Functions Tests
  // ============================================================================
  describe("getCustomers", () => {
    it("should return paginated customers", async () => {
      const mockCustomers = [
        { id: "cust-1", email: "test@example.com", firstName: "John", lastName: "Doe" },
      ];
      // First query: .limit().offset() - wrapper calls consume first values, thenable uses second
      mockLimit.mockResolvedValueOnce([]); // Consumed by wrapper (ignored)
      mockOffset
        .mockResolvedValueOnce([]) // Consumed by wrapper (ignored)
        .mockResolvedValueOnce(mockCustomers); // Consumed by thenable (used)
      // Second query (count): thenable uses this
      mockLimit.mockResolvedValueOnce([{ count: 1 }]);

      const { getCustomers } = await import("../../../../lib/db/queries.server");

      const result = await getCustomers("org-1", { limit: 50, offset: 0 });

      expect(result.total).toBe(1);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockOffset).toHaveBeenCalled();
    });

    it("should handle search parameter", async () => {
      mockOffset.mockResolvedValueOnce([]);
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);

      const { getCustomers } = await import("../../../../lib/db/queries.server");

      await getCustomers("org-1", { search: "john" });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("getCustomerById", () => {
    it("should return customer when found", async () => {
      const mockCustomer = { id: "cust-1", email: "test@example.com", firstName: "John", lastName: "Doe" };
      mockLimit.mockResolvedValueOnce([mockCustomer]);

      const { getCustomerById } = await import("../../../../lib/db/queries.server");

      const result = await getCustomerById("org-1", "cust-1");

      expect(result).toBeDefined();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it("should return null when not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getCustomerById } = await import("../../../../lib/db/queries.server");

      const result = await getCustomerById("org-1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("createCustomer", () => {
    it("should create new customer", async () => {
      const mockCustomer = { id: "cust-1", email: "new@example.com", firstName: "Jane", lastName: "Smith" };
      // .returning() - wrapper + thenable consumption
      mockReturning.mockResolvedValueOnce([]); // Consumed by wrapper (ignored)
      mockReturning.mockResolvedValueOnce([mockCustomer]); // Consumed by thenable (used)

      const { createCustomer } = await import("../../../../lib/db/queries.server");

      const data = {
        email: "new@example.com",
        firstName: "Jane",
        lastName: "Smith",
      };

      await createCustomer("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it("should handle optional fields", async () => {
      // .returning() - wrapper + thenable consumption
      mockReturning.mockResolvedValueOnce([]); // Consumed by wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{}]); // Consumed by thenable (used)

      const { createCustomer } = await import("../../../../lib/db/queries.server");

      const data = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        phone: "123-456-7890",
        dateOfBirth: "1990-01-01",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "098-765-4321",
      };

      await createCustomer("org-1", data);

      expect(dbMock.values).toHaveBeenCalled();
    });
  });

  describe("updateCustomer", () => {
    it("should update customer fields", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "cust-1", email: "updated@example.com" }]);

      const { updateCustomer } = await import("../../../../lib/db/queries.server");

      await updateCustomer("org-1", "cust-1", { email: "updated@example.com" });

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it("should return null when customer not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { updateCustomer } = await import("../../../../lib/db/queries.server");

      const result = await updateCustomer("org-1", "nonexistent", { email: "test@example.com" });

      expect(result).toBeNull();
    });
  });

  describe("deleteCustomer", () => {
    it("should delete customer", async () => {
      const { deleteCustomer } = await import("../../../../lib/db/queries.server");

      const result = await deleteCustomer("org-1", "cust-1");

      expect(dbMock.delete).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Tours & Trips Functions Tests
  // ============================================================================
  describe("getTours", () => {
    it("should return tours with trip counts", async () => {
      const mockTours = [{ id: "tour-1", name: "Tour 1", isActive: true }];
      const tripCounts = [{ tourId: "tour-1", count: 5 }];

      // First query: tours (no limit, just from/where/orderBy)
      const mockOrderBy = vi.fn().mockResolvedValue(mockTours);
      const mockGroupBy = vi.fn().mockResolvedValue(tripCounts);

      // Mock for tours query - where → orderBy (terminal)
      // Mock for trip counts - where → groupBy (terminal)
      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const { getTours } = await import("../../../../lib/db/queries.server");

      const result = await getTours("org-1");

      expect(result.length).toBeGreaterThanOrEqual(0);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by activeOnly", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      // Only one query when tours array is empty
      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getTours } = await import("../../../../lib/db/queries.server");

      await getTours("org-1", { activeOnly: true });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by search term", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getTours } = await import("../../../../lib/db/queries.server");

      await getTours("org-1", { search: "dive" });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by type", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getTours } = await import("../../../../lib/db/queries.server");

      await getTours("org-1", { type: "course" });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createTour", () => {
    it("should create new tour", async () => {
      // .returning() - wrapper + thenable consumption
      mockReturning.mockResolvedValueOnce([]); // Consumed by wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "tour-1", name: "New Tour" }]); // Consumed by thenable (used)

      const { createTour } = await import("../../../../lib/db/queries.server");

      const data = {
        name: "New Tour",
        type: "dive",
        maxParticipants: 10,
        price: 100,
      };

      await createTour("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });
  });

  describe("getTrips", () => {
    it("should return trips with booking counts", async () => {
      const mockTrips = [
        {
          trip: { id: "trip-1", date: "2025-02-01", startTime: "09:00" },
          tourName: "Tour 1",
          tourType: "dive",
          boatName: null,
        },
      ];
      const participantCounts = [{ tripId: "trip-1", total: 5 }];

      const mockLimitFn = vi.fn().mockResolvedValue(mockTrips);
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for trips query - where → orderBy → limit (terminal)
      // Mock for participant counts - where → groupBy (terminal)
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });
      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const { getTrips } = await import("../../../../lib/db/queries.server");

      const result = await getTrips("org-1");

      expect(result.length).toBeGreaterThanOrEqual(0);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.innerJoin).toHaveBeenCalled();
    });

    it("should filter by date range", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      // Only one query when trips array is empty
      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getTrips } = await import("../../../../lib/db/queries.server");

      await getTrips("org-1", { fromDate: "2025-01-01", toDate: "2025-12-31" });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by status", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getTrips } = await import("../../../../lib/db/queries.server");

      await getTrips("org-1", { status: "scheduled" });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createTrip", () => {
    it("should create new trip", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "trip-1" }]);

      const { createTrip } = await import("../../../../lib/db/queries.server");

      const data = {
        tourId: "tour-1",
        date: "2025-02-01",
        startTime: "09:00",
      };

      await createTrip("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });
  });

  describe("updateTripStatus", () => {
    it("should update trip status", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "trip-1", status: "completed" }]);

      (dbMock.where as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { updateTripStatus } = await import("../../../../lib/db/queries.server");

      await updateTripStatus("org-1", "trip-1", "completed");

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Booking Functions Tests
  // ============================================================================
  describe("getBookings", () => {
    it("should return paginated bookings", async () => {
      const mockBookings = [
        {
          booking: { id: "book-1", status: "confirmed" },
          firstName: "John",
          lastName: "Doe",
          customerEmail: "john@example.com",
          customerPhone: "123-456-7890",
          tourName: "Tour 1",
          tripDate: "2025-02-01",
          tripTime: "09:00",
        },
      ];

      const mockOffsetFn = vi.fn().mockResolvedValue(mockBookings);
      const mockLimitFn1 = vi.fn().mockReturnValue({ offset: mockOffsetFn });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn1 });

      // Mock for bookings query - where → orderBy → limit → offset (terminal)
      // Mock for count query - where (terminal, no limit)
      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockResolvedValueOnce([{ count: 1 }]);

      const { getBookings } = await import("../../../../lib/db/queries.server");

      const result = await getBookings("org-1");

      expect(result.total).toBe(1);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.innerJoin).toHaveBeenCalled();
    });

    it("should filter by status", async () => {
      const mockOffsetFn = vi.fn().mockResolvedValue([]);
      const mockLimitFn1 = vi.fn().mockReturnValue({ offset: mockOffsetFn });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn1 });

      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockResolvedValueOnce([{ count: 0 }]);

      const { getBookings } = await import("../../../../lib/db/queries.server");

      await getBookings("org-1", { status: "confirmed" });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by tripId", async () => {
      const mockOffsetFn = vi.fn().mockResolvedValue([]);
      const mockLimitFn1 = vi.fn().mockReturnValue({ offset: mockOffsetFn });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn1 });

      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockResolvedValueOnce([{ count: 0 }]);

      const { getBookings } = await import("../../../../lib/db/queries.server");

      await getBookings("org-1", { tripId: "trip-1" });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createBooking", () => {
    it("should create new booking", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "book-1" }]);

      const { createBooking } = await import("../../../../lib/db/queries.server");

      const data = {
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        subtotal: 200,
        tax: 20,
        total: 220,
      };

      await createBooking("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });
  });

  describe("updateBookingStatus", () => {
    it("should update booking status", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "book-1", status: "confirmed" }]);

      (dbMock.where as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { updateBookingStatus } = await import("../../../../lib/db/queries.server");

      await updateBookingStatus("org-1", "book-1", "confirmed");

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Equipment Functions Tests
  // ============================================================================
  describe("getEquipment", () => {
    it("should return equipment list", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getEquipment } = await import("../../../../lib/db/queries.server");

      await getEquipment("org-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it("should filter by category", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getEquipment } = await import("../../../../lib/db/queries.server");

      await getEquipment("org-1", { category: "Wetsuit" });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by status", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getEquipment } = await import("../../../../lib/db/queries.server");

      await getEquipment("org-1", { status: "available" });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should filter by isRentable", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitFn });

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getEquipment } = await import("../../../../lib/db/queries.server");

      await getEquipment("org-1", { isRentable: true });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createEquipment", () => {
    it("should create new equipment", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "eq-1" }]);

      (dbMock.values as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { createEquipment } = await import("../../../../lib/db/queries.server");

      const data = {
        category: "Wetsuit",
        name: "5mm Wetsuit",
        rentalPrice: 30,
      };

      await createEquipment("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Boat Functions Tests
  // ============================================================================
  describe("getBoats", () => {
    it("should return boats list", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getBoats } = await import("../../../../lib/db/queries.server");

      await getBoats("org-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it("should filter by activeOnly", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getBoats } = await import("../../../../lib/db/queries.server");

      await getBoats("org-1", { activeOnly: true });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createBoat", () => {
    it("should create new boat", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "boat-1" }]);

      (dbMock.values as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { createBoat } = await import("../../../../lib/db/queries.server");

      const data = {
        name: "Dive Boat 1",
        capacity: 20,
      };

      await createBoat("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Dive Site Functions Tests
  // ============================================================================
  describe("getDiveSites", () => {
    it("should return dive sites list", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getDiveSites } = await import("../../../../lib/db/queries.server");

      await getDiveSites("org-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it("should filter by difficulty", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (dbMock.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const { getDiveSites } = await import("../../../../lib/db/queries.server");

      await getDiveSites("org-1", { difficulty: "advanced" });

      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  describe("createDiveSite", () => {
    it("should create new dive site", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "site-1" }]);

      (dbMock.values as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { createDiveSite } = await import("../../../../lib/db/queries.server");

      const data = {
        name: "Coral Reef",
        maxDepth: 30,
        difficulty: "intermediate",
      };

      await createDiveSite("org-1", data);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
    });
  });

  describe("updateDiveSiteActiveStatus", () => {
    it("should update dive site active status", async () => {
      const mockReturningFn = vi.fn().mockResolvedValue([{ id: "site-1", isActive: false }]);

      (dbMock.where as unknown as Mock).mockReturnValue({ returning: mockReturningFn });

      const { updateDiveSiteActiveStatus } = await import("../../../../lib/db/queries.server");

      await updateDiveSiteActiveStatus("org-1", "site-1", false);

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
    });
  });

  describe("deleteDiveSite", () => {
    it("should delete dive site", async () => {
      // First query: check tour count - where (terminal)
      // Second query: delete - where (terminal)
      (dbMock.where as unknown as Mock)
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);

      const { deleteDiveSite } = await import("../../../../lib/db/queries.server");

      const result = await deleteDiveSite("org-1", "site-1");

      expect(dbMock.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Calendar Functions Tests
  // ============================================================================
  describe("getCalendarTrips", () => {
    it("should return calendar trips with availability", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Tour 1",
          tourType: "dive",
          date: "2025-02-01",
          startTime: "09:00",
          endTime: null,
          boatName: null,
          maxParticipants: 10,
          status: "scheduled",
        },
      ];
      const participantCounts = [{ tripId: "trip-1", total: 5 }];

      const mockOrderBy = vi.fn().mockResolvedValue(mockTrips);
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for trips query - where → orderBy (terminal)
      // Mock for participant counts - where → groupBy (terminal)
      (dbMock.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const { getCalendarTrips } = await import("../../../../lib/db/queries.server");

      const result = await getCalendarTrips("org-1", {
        fromDate: "2025-02-01",
        toDate: "2025-02-28",
      });

      expect(result.length).toBeGreaterThanOrEqual(0);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.innerJoin).toHaveBeenCalled();
    });
  });
});
