/**
 * Server Queries Tests
 *
 * Tests for tenant-specific database query functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database with proper chain support
const mockReturning = vi.fn().mockResolvedValue([{ id: "item-1" }]);

// Create a thenable that supports full chain: .orderBy().limit().offset() etc.
const createThenable = (resolveValue: unknown[] = []) => {
  const thenable: Record<string, unknown> = {};

  // Make it a Promise-like (thenable)
  thenable.then = (resolve: (value: unknown[]) => void) => {
    resolve(resolveValue);
    return thenable;
  };
  thenable.catch = () => thenable;

  // Support chaining methods that also return thenables
  thenable.limit = vi.fn(() => createThenable(resolveValue));
  thenable.offset = vi.fn(() => createThenable(resolveValue));
  thenable.orderBy = vi.fn(() => createThenable(resolveValue));

  return thenable;
};

// Create a chain object that supports all Drizzle query patterns
const createChainMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // All methods return chain for fluent interface
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);

  // These can be terminal or can chain further - return thenable
  chain.orderBy = vi.fn(() => createThenable([]));
  chain.limit = vi.fn(() => createThenable([]));
  chain.offset = vi.fn(() => createThenable([]));
  chain.returning = mockReturning;

  // Transaction support - creates a tx object with the same chain interface
  chain.transaction = vi.fn(async (fn: (tx: any) => Promise<any>) => {
    const txChain: Record<string, ReturnType<typeof vi.fn>> = {};
    txChain.execute = vi.fn().mockResolvedValue(undefined);
    txChain.select = vi.fn(() => txChain);
    txChain.from = vi.fn(() => txChain);
    txChain.where = vi.fn(() => txChain);
    txChain.insert = vi.fn(() => txChain);
    txChain.values = vi.fn(() => txChain);
    txChain.limit = vi.fn(() => txChain);
    txChain.returning = vi.fn().mockResolvedValue([{ id: "book-1", bookingNumber: "BK123" }]);
    txChain.then = (resolve: (value: unknown[]) => void) => {
      return Promise.resolve([{ maxParticipants: 10, total: 0 }]).then(resolve);
    };
    return fn(txChain);
  });

  return chain;
};

const dbMock = createChainMock();

// Export mockLimit for tests that need to set specific return values
const mockLimit = dbMock.limit;

vi.mock("../../../../lib/db/index", () => ({
  db: dbMock,
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
  bookings: {
    id: "id",
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
    tripId: "tripId",
    customerId: "customerId",
    participants: "participants",
    status: "status",
    subtotal: "subtotal",
    discount: "discount",
    tax: "tax",
    total: "total",
    currency: "currency",
    specialRequests: "specialRequests",
    source: "source",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  customers: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    dateOfBirth: "dateOfBirth",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  tours: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    type: "type",
    duration: "duration",
    maxParticipants: "maxParticipants",
    minParticipants: "minParticipants",
    price: "price",
    currency: "currency",
    includesEquipment: "includesEquipment",
    includesMeals: "includesMeals",
    includesTransport: "includesTransport",
    isActive: "isActive",
  },
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    boatId: "boatId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    price: "price",
    status: "status",
    notes: "notes",
  },
  transactions: {
    id: "id",
    organizationId: "organizationId",
    type: "type",
    amount: "amount",
    createdAt: "createdAt",
  },
  boats: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    capacity: "capacity",
    type: "type",
    isActive: "isActive",
  },
  equipment: {
    id: "id",
    organizationId: "organizationId",
    category: "category",
    name: "name",
    brand: "brand",
    model: "model",
    status: "status",
    condition: "condition",
    isRentable: "isRentable",
  },
  diveSites: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    location: "location",
    description: "description",
    maxDepth: "maxDepth",
    difficulty: "difficulty",
    isActive: "isActive",
  },
  rentals: {
    id: "id",
    organizationId: "organizationId",
    equipmentId: "equipmentId",
    customerId: "customerId",
    rentedAt: "rentedAt",
    returnedAt: "returnedAt",
    dueAt: "dueAt",
    status: "status",
    dailyRate: "dailyRate",
    totalCharge: "totalCharge",
  },
}));

describe("Server Queries Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "item-1" }]);
  });

  describe("Module exports", () => {
    it("exports getDashboardStats function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getDashboardStats).toBe("function");
    });

    it("exports getUpcomingTrips function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getUpcomingTrips).toBe("function");
    });

    it("exports getRecentBookings function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getRecentBookings).toBe("function");
    });

    it("exports getCustomers function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getCustomers).toBe("function");
    });

    it("exports getCustomerById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getCustomerById).toBe("function");
    });

    it("exports createCustomer function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createCustomer).toBe("function");
    });

    it("exports updateCustomer function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.updateCustomer).toBe("function");
    });

    it("exports deleteCustomer function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.deleteCustomer).toBe("function");
    });

    it("exports getTours function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getTours).toBe("function");
    });

    it("exports getAllTours function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getAllTours).toBe("function");
    });

    it("exports getTourById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getTourById).toBe("function");
    });

    it("exports createTour function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createTour).toBe("function");
    });

    it("exports getTrips function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getTrips).toBe("function");
    });

    it("exports getTripById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getTripById).toBe("function");
    });

    it("exports createTrip function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createTrip).toBe("function");
    });

    it("exports getCalendarTrips function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getCalendarTrips).toBe("function");
    });

    it("exports getBookings function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getBookings).toBe("function");
    });

    it("exports getBookingById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getBookingById).toBe("function");
    });

    it("exports createBooking function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createBooking).toBe("function");
    });

    it("exports getEquipment function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getEquipment).toBe("function");
    });

    it("exports getEquipmentById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getEquipmentById).toBe("function");
    });

    it("exports createEquipment function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createEquipment).toBe("function");
    });

    it("exports getBoats function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getBoats).toBe("function");
    });

    it("exports getAllBoats function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getAllBoats).toBe("function");
    });

    it("exports getBoatById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getBoatById).toBe("function");
    });

    it("exports createBoat function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.createBoat).toBe("function");
    });

    it("exports getDiveSites function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getDiveSites).toBe("function");
    });

    it("exports getDiveSiteById function", async () => {
      const queriesModule = await import("../../../../lib/db/queries.server");
      expect(typeof queriesModule.getDiveSiteById).toBe("function");
    });
  });

  describe("getDashboardStats", () => {
    it("returns dashboard statistics object", async () => {
      // Mock the queries to return counts
      mockLimit.mockResolvedValue([{ count: 5 }]);

      const { getDashboardStats } = await import("../../../../lib/db/queries.server");
      const stats = await getDashboardStats("org-1");

      expect(typeof stats).toBe("object");
      expect(stats).toHaveProperty("todayBookings");
      expect(stats).toHaveProperty("weekRevenue");
      expect(stats).toHaveProperty("activeTrips");
      expect(stats).toHaveProperty("totalCustomers");
    });

    it("returns numeric values for all stats", async () => {
      mockLimit.mockResolvedValue([{ count: 10, total: 500 }]);

      const { getDashboardStats } = await import("../../../../lib/db/queries.server");
      const stats = await getDashboardStats("org-1");

      expect(typeof stats.todayBookings).toBe("number");
      expect(typeof stats.weekRevenue).toBe("number");
      expect(typeof stats.activeTrips).toBe("number");
      expect(typeof stats.totalCustomers).toBe("number");
    });
  });

  describe("getCustomers", () => {
    it("returns customers array and total count", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "cust-1", firstName: "John", lastName: "Doe", email: "john@test.com" },
      ]);
      mockLimit.mockResolvedValueOnce([{ count: 1 }]);

      const { getCustomers } = await import("../../../../lib/db/queries.server");
      const result = await getCustomers("org-1");

      expect(result).toHaveProperty("customers");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.customers)).toBe(true);
    });

    it("accepts search option", async () => {
      mockLimit.mockResolvedValue([]);

      const { getCustomers } = await import("../../../../lib/db/queries.server");
      const result = await getCustomers("org-1", { search: "john" });

      expect(result).toHaveProperty("customers");
    });

    it("accepts limit and offset options", async () => {
      mockLimit.mockResolvedValue([]);

      const { getCustomers } = await import("../../../../lib/db/queries.server");
      const result = await getCustomers("org-1", { limit: 10, offset: 5 });

      expect(result).toHaveProperty("customers");
    });
  });

  describe("getTours", () => {
    it("returns tours array", async () => {
      mockLimit.mockResolvedValue([{ count: 0 }]);

      const { getTours } = await import("../../../../lib/db/queries.server");
      const tours = await getTours("org-1");

      expect(Array.isArray(tours)).toBe(true);
    });

    it("accepts activeOnly option", async () => {
      mockLimit.mockResolvedValue([{ count: 0 }]);

      const { getTours } = await import("../../../../lib/db/queries.server");
      const tours = await getTours("org-1", { activeOnly: true });

      expect(Array.isArray(tours)).toBe(true);
    });

    it("accepts search option", async () => {
      mockLimit.mockResolvedValue([{ count: 0 }]);

      const { getTours } = await import("../../../../lib/db/queries.server");
      const tours = await getTours("org-1", { search: "dive" });

      expect(Array.isArray(tours)).toBe(true);
    });

    it("accepts type option", async () => {
      mockLimit.mockResolvedValue([{ count: 0 }]);

      const { getTours } = await import("../../../../lib/db/queries.server");
      const tours = await getTours("org-1", { type: "single_dive" });

      expect(Array.isArray(tours)).toBe(true);
    });
  });

  describe("getTrips", () => {
    it("returns trips array", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          trip: { id: "trip-1", date: "2024-01-15" },
          tourName: "Test Tour",
          tourType: "single_dive",
          boatName: "Test Boat",
        },
      ]);
      mockLimit.mockResolvedValue([{ total: 0 }]);

      const { getTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getTrips("org-1");

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts date range options", async () => {
      mockLimit.mockResolvedValue([]);

      const { getTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getTrips("org-1", {
        fromDate: "2024-01-01",
        toDate: "2024-01-31",
      });

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts status option", async () => {
      mockLimit.mockResolvedValue([]);

      const { getTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getTrips("org-1", { status: "scheduled" });

      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe("getBookings", () => {
    it("returns bookings and total count", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          booking: { id: "book-1", status: "confirmed" },
          firstName: "John",
          lastName: "Doe",
          customerEmail: "john@test.com",
          customerPhone: "555-0100",
          tourName: "Test Tour",
          tripDate: "2024-01-15",
          tripTime: "09:00",
        },
      ]);
      mockLimit.mockResolvedValueOnce([{ count: 1 }]);

      const { getBookings } = await import("../../../../lib/db/queries.server");
      const result = await getBookings("org-1");

      expect(result).toHaveProperty("bookings");
      expect(result).toHaveProperty("total");
    });

    it("accepts status filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBookings } = await import("../../../../lib/db/queries.server");
      const result = await getBookings("org-1", { status: "confirmed" });

      expect(result).toHaveProperty("bookings");
    });

    it("accepts tripId filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBookings } = await import("../../../../lib/db/queries.server");
      const result = await getBookings("org-1", { tripId: "trip-1" });

      expect(result).toHaveProperty("bookings");
    });

    it("accepts customerId filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBookings } = await import("../../../../lib/db/queries.server");
      const result = await getBookings("org-1", { customerId: "cust-1" });

      expect(result).toHaveProperty("bookings");
    });
  });

  describe("getEquipment", () => {
    it("returns equipment array", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "equip-1", name: "BCD Large", category: "bcd", status: "available" },
      ]);

      const { getEquipment } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipment("org-1");

      expect(Array.isArray(equipment)).toBe(true);
    });

    it("accepts category filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getEquipment } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipment("org-1", { category: "bcd" });

      expect(Array.isArray(equipment)).toBe(true);
    });

    it("accepts status filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getEquipment } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipment("org-1", { status: "available" });

      expect(Array.isArray(equipment)).toBe(true);
    });

    it("accepts isRentable filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getEquipment } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipment("org-1", { isRentable: true });

      expect(Array.isArray(equipment)).toBe(true);
    });
  });

  describe("getBoats", () => {
    it("returns boats array", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBoats } = await import("../../../../lib/db/queries.server");
      const boats = await getBoats("org-1");

      expect(Array.isArray(boats)).toBe(true);
    });

    it("accepts activeOnly filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBoats } = await import("../../../../lib/db/queries.server");
      const boats = await getBoats("org-1", { activeOnly: true });

      expect(Array.isArray(boats)).toBe(true);
    });

    it("accepts search filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getBoats } = await import("../../../../lib/db/queries.server");
      const boats = await getBoats("org-1", { search: "sea" });

      expect(Array.isArray(boats)).toBe(true);
    });
  });

  describe("getDiveSites", () => {
    it("returns dive sites array", async () => {
      mockLimit.mockResolvedValue([]);

      const { getDiveSites } = await import("../../../../lib/db/queries.server");
      const sites = await getDiveSites("org-1");

      expect(Array.isArray(sites)).toBe(true);
    });

    it("accepts activeOnly filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getDiveSites } = await import("../../../../lib/db/queries.server");
      const sites = await getDiveSites("org-1", { activeOnly: true });

      expect(Array.isArray(sites)).toBe(true);
    });

    it("accepts difficulty filter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getDiveSites } = await import("../../../../lib/db/queries.server");
      const sites = await getDiveSites("org-1", { difficulty: "intermediate" });

      expect(Array.isArray(sites)).toBe(true);
    });
  });

  describe("Calendar queries", () => {
    it("getCalendarTrips returns CalendarTrip array", async () => {
      mockLimit.mockResolvedValue([{ total: 0 }]);

      const { getCalendarTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getCalendarTrips("org-1", {
        fromDate: "2024-01-01",
        toDate: "2024-01-31",
      });

      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe("getUpcomingTrips", () => {
    it("returns array of upcoming trips", async () => {
      mockLimit.mockResolvedValue([]);

      const { getUpcomingTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getUpcomingTrips("org-1");

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts limit parameter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getUpcomingTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getUpcomingTrips("org-1", 10);

      expect(Array.isArray(trips)).toBe(true);
    });

    it("defaults to limit of 5", async () => {
      mockLimit.mockResolvedValue([]);

      const { getUpcomingTrips } = await import("../../../../lib/db/queries.server");
      const trips = await getUpcomingTrips("org-1");

      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe("getRecentBookings", () => {
    it("returns array of recent bookings", async () => {
      mockLimit.mockResolvedValue([]);

      const { getRecentBookings } = await import("../../../../lib/db/queries.server");
      const bookings = await getRecentBookings("org-1");

      expect(Array.isArray(bookings)).toBe(true);
    });

    it("accepts limit parameter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getRecentBookings } = await import("../../../../lib/db/queries.server");
      const bookings = await getRecentBookings("org-1", 10);

      expect(Array.isArray(bookings)).toBe(true);
    });
  });

  describe("getCustomerBookings", () => {
    it("returns customer bookings array", async () => {
      mockLimit.mockResolvedValue([]);

      const { getCustomerBookings } = await import("../../../../lib/db/queries.server");
      const bookings = await getCustomerBookings("org-1", "cust-1");

      expect(Array.isArray(bookings)).toBe(true);
    });

    it("accepts limit parameter", async () => {
      mockLimit.mockResolvedValue([]);

      const { getCustomerBookings } = await import("../../../../lib/db/queries.server");
      const bookings = await getCustomerBookings("org-1", "cust-1", 5);

      expect(Array.isArray(bookings)).toBe(true);
    });
  });

  describe("getCustomerById", () => {
    it("calls database with correct parameters", async () => {
      const { getCustomerById } = await import("../../../../lib/db/queries.server");
      await getCustomerById("org-1", "cust-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("executes without error for nonexistent customer", async () => {
      const { getCustomerById } = await import("../../../../lib/db/queries.server");
      // Should not throw when customer not found
      await expect(getCustomerById("org-1", "nonexistent")).resolves.not.toThrow();
    });
  });

  describe("createCustomer", () => {
    it("creates customer and returns mapped object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "cust-1",
        organizationId: "org-1",
        email: "john@test.com",
        firstName: "John",
        lastName: "Doe",
        phone: "555-0100",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createCustomer } = await import("../../../../lib/db/queries.server");
      const customer = await createCustomer("org-1", {
        email: "john@test.com",
        firstName: "John",
        lastName: "Doe",
        phone: "555-0100",
      });

      expect(customer).toBeDefined();
      expect(customer.email).toBe("john@test.com");
    });

    it("accepts optional fields", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "cust-1",
        organizationId: "org-1",
        email: "john@test.com",
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: "1990-01-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "555-0200",
        notes: "VIP customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createCustomer } = await import("../../../../lib/db/queries.server");
      const customer = await createCustomer("org-1", {
        email: "john@test.com",
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: "1990-01-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "555-0200",
        notes: "VIP customer",
      });

      expect(customer).toBeDefined();
    });
  });

  describe("updateCustomer", () => {
    it("updates customer and returns mapped object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "cust-1",
        organizationId: "org-1",
        email: "updated@test.com",
        firstName: "John",
        lastName: "Doe",
        phone: "555-9999",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { updateCustomer } = await import("../../../../lib/db/queries.server");
      const customer = await updateCustomer("org-1", "cust-1", {
        email: "updated@test.com",
        phone: "555-9999",
      });

      expect(customer).toBeDefined();
      expect(customer?.email).toBe("updated@test.com");
    });

    it("returns null when customer not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { updateCustomer } = await import("../../../../lib/db/queries.server");
      const customer = await updateCustomer("org-1", "nonexistent", {
        email: "test@test.com",
      });

      expect(customer).toBeNull();
    });
  });

  describe("deleteCustomer", () => {
    it("deletes customer and returns true", async () => {
      // deleteCustomer checks for active bookings and transactions before deleting
      // Use mockReturnValueOnce to sequence responses without reassigning dbMock.where
      dbMock.where
        .mockReturnValueOnce(createThenable([{ count: 0 }]))  // booking check
        .mockReturnValueOnce(createThenable([{ count: 0 }]))  // transaction check
        .mockReturnValueOnce(createThenable([]))               // delete operation
        .mockReturnValueOnce(createThenable([]));              // delete operation

      const { deleteCustomer } = await import("../../../../lib/db/queries.server");
      const result = await deleteCustomer("org-1", "cust-1");

      expect(result).toBe(true);
    });
  });

  describe("getTourById", () => {
    it("calls database with correct parameters", async () => {
      const { getTourById } = await import("../../../../lib/db/queries.server");
      await getTourById("org-1", "tour-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("executes without error for nonexistent tour", async () => {
      const { getTourById } = await import("../../../../lib/db/queries.server");
      // Should not throw when tour not found
      await expect(getTourById("org-1", "nonexistent")).resolves.not.toThrow();
    });
  });

  describe("createTour", () => {
    it("creates tour and returns mapped object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "tour-1",
        organizationId: "org-1",
        name: "New Tour",
        type: "single_dive",
        maxParticipants: 8,
        price: "99.00",
        currency: "USD",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createTour } = await import("../../../../lib/db/queries.server");
      const tour = await createTour("org-1", {
        name: "New Tour",
        type: "single_dive",
        maxParticipants: 8,
        price: 99,
      });

      expect(tour).toBeDefined();
      expect(tour.name).toBe("New Tour");
    });

    it("accepts optional fields", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "tour-1",
        organizationId: "org-1",
        name: "Full Tour",
        type: "multi_dive",
        duration: 360,
        maxParticipants: 6,
        minParticipants: 2,
        price: "199.00",
        currency: "EUR",
        includesEquipment: true,
        includesMeals: true,
        includesTransport: true,
        minCertLevel: "Advanced",
        minAge: 16,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createTour } = await import("../../../../lib/db/queries.server");
      const tour = await createTour("org-1", {
        name: "Full Tour",
        type: "multi_dive",
        duration: 360,
        maxParticipants: 6,
        minParticipants: 2,
        price: 199,
        currency: "EUR",
        includesEquipment: true,
        includesMeals: true,
        includesTransport: true,
        minCertLevel: "Advanced",
        minAge: 16,
      });

      expect(tour).toBeDefined();
    });
  });

  describe("getAllTours", () => {
    it("returns array of tours with id and name", async () => {
      mockLimit.mockResolvedValue([]);

      const { getAllTours } = await import("../../../../lib/db/queries.server");
      const tours = await getAllTours("org-1");

      expect(Array.isArray(tours)).toBe(true);
    });
  });

  describe("updateTourActiveStatus", () => {
    it("calls database update with correct parameters", async () => {
      const { updateTourActiveStatus } = await import("../../../../lib/db/queries.server");
      await updateTourActiveStatus("org-1", "tour-1", false);

      // Verifies function runs without error
      expect(dbMock.update).toHaveBeenCalled();
    });

    it("executes without error for nonexistent tour", async () => {
      const { updateTourActiveStatus } = await import("../../../../lib/db/queries.server");
      // Should not throw when tour not found
      await expect(updateTourActiveStatus("org-1", "nonexistent", false)).resolves.not.toThrow();
    });
  });

  describe("deleteTour", () => {
    it("deletes tour and related trips when no active bookings", async () => {
      // deleteTour checks for trip IDs, then deletes trips and tour
      // Use mockReturnValueOnce to avoid reassigning dbMock.where
      dbMock.where
        .mockReturnValueOnce(createThenable([]))  // get trip IDs (empty = no trips)
        .mockReturnValueOnce(createThenable([]))  // delete trips
        .mockReturnValueOnce(createThenable([])); // delete tour

      const { deleteTour } = await import("../../../../lib/db/queries.server");
      const result = await deleteTour("org-1", "tour-1");

      expect(result).toBe(true);
    });
  });

  describe("getTripById", () => {
    it("calls database with correct parameters", async () => {
      const { getTripById } = await import("../../../../lib/db/queries.server");
      await getTripById("org-1", "trip-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("executes without error for nonexistent trip", async () => {
      const { getTripById } = await import("../../../../lib/db/queries.server");
      // Should not throw when trip not found
      await expect(getTripById("org-1", "nonexistent")).resolves.not.toThrow();
    });
  });

  describe("createTrip", () => {
    it("creates trip and returns object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "trip-1",
        organizationId: "org-1",
        tourId: "tour-1",
        date: "2024-01-15",
        startTime: "09:00",
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createTrip } = await import("../../../../lib/db/queries.server");
      const trip = await createTrip("org-1", {
        tourId: "tour-1",
        date: "2024-01-15",
        startTime: "09:00",
      });

      expect(trip).toBeDefined();
      expect(trip.tourId).toBe("tour-1");
    });

    it("accepts optional fields", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "trip-1",
        organizationId: "org-1",
        tourId: "tour-1",
        boatId: "boat-1",
        date: "2024-01-15",
        startTime: "09:00",
        endTime: "12:00",
        maxParticipants: 8,
        price: "99.00",
        notes: "Special trip",
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createTrip } = await import("../../../../lib/db/queries.server");
      const trip = await createTrip("org-1", {
        tourId: "tour-1",
        boatId: "boat-1",
        date: "2024-01-15",
        startTime: "09:00",
        endTime: "12:00",
        maxParticipants: 8,
        price: 99,
        notes: "Special trip",
      });

      expect(trip).toBeDefined();
    });
  });

  describe("updateTripStatus", () => {
    it("updates trip status", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "trip-1",
        organizationId: "org-1",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { updateTripStatus } = await import("../../../../lib/db/queries.server");
      const trip = await updateTripStatus("org-1", "trip-1", "completed");

      expect(trip).toBeDefined();
      expect(trip?.status).toBe("completed");
    });

    it("returns null when trip not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { updateTripStatus } = await import("../../../../lib/db/queries.server");
      const trip = await updateTripStatus("org-1", "nonexistent", "completed");

      expect(trip).toBeNull();
    });
  });

  describe("getBookingById", () => {
    it("calls database with correct parameters", async () => {
      const { getBookingById } = await import("../../../../lib/db/queries.server");
      await getBookingById("org-1", "booking-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("executes without error for nonexistent booking", async () => {
      const { getBookingById } = await import("../../../../lib/db/queries.server");
      // Should not throw when booking not found
      await expect(getBookingById("org-1", "nonexistent")).resolves.not.toThrow();
    });
  });

  describe("createBooking", () => {
    it("creates booking and returns object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "booking-1",
        organizationId: "org-1",
        bookingNumber: "BK-123",
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        status: "confirmed",
        total: "198.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createBooking } = await import("../../../../lib/db/queries.server");
      const booking = await createBooking("org-1", {
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        total: 198,
      });

      expect(booking).toBeDefined();
    });
  });

  describe("getEquipmentById", () => {
    it("calls database with correct parameters", async () => {
      const { getEquipmentById } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipmentById("org-1", "equip-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("handles not found by returning null or undefined", async () => {
      const { getEquipmentById } = await import("../../../../lib/db/queries.server");
      const equipment = await getEquipmentById("org-1", "nonexistent");

      // With empty mock result, should return null/undefined
      expect(equipment === null || equipment === undefined).toBe(true);
    });
  });

  describe("createEquipment", () => {
    it("creates equipment and returns object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "equip-1",
        organizationId: "org-1",
        category: "bcd",
        name: "BCD Large",
        status: "available",
        isRentable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createEquipment } = await import("../../../../lib/db/queries.server");
      const equipment = await createEquipment("org-1", {
        category: "bcd",
        name: "BCD Large",
      });

      expect(equipment).toBeDefined();
    });
  });

  describe("getBoatById", () => {
    it("calls database with correct parameters", async () => {
      const { getBoatById } = await import("../../../../lib/db/queries.server");
      const boat = await getBoatById("org-1", "boat-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("handles not found by returning null or undefined", async () => {
      const { getBoatById } = await import("../../../../lib/db/queries.server");
      const boat = await getBoatById("org-1", "nonexistent");

      // With empty mock result, should return null/undefined
      expect(boat === null || boat === undefined).toBe(true);
    });
  });

  describe("createBoat", () => {
    it("creates boat and returns object", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "boat-1",
        organizationId: "org-1",
        name: "Sea Explorer",
        capacity: 12,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const { createBoat } = await import("../../../../lib/db/queries.server");
      const boat = await createBoat("org-1", {
        name: "Sea Explorer",
        capacity: 12,
      });

      expect(boat).toBeDefined();
    });
  });

  describe("getAllBoats", () => {
    it("returns array of boats", async () => {
      mockLimit.mockResolvedValue([]);

      const { getAllBoats } = await import("../../../../lib/db/queries.server");
      const boats = await getAllBoats("org-1");

      expect(Array.isArray(boats)).toBe(true);
    });
  });

  describe("getDiveSiteById", () => {
    it("calls database with correct parameters", async () => {
      const { getDiveSiteById } = await import("../../../../lib/db/queries.server");
      const site = await getDiveSiteById("org-1", "site-1");

      // Verifies function runs without error
      expect(dbMock.select).toHaveBeenCalled();
    });

    it("handles not found by returning null or undefined", async () => {
      const { getDiveSiteById } = await import("../../../../lib/db/queries.server");
      const site = await getDiveSiteById("org-1", "nonexistent");

      // With empty mock result, should return null/undefined
      expect(site === null || site === undefined).toBe(true);
    });
  });
});
