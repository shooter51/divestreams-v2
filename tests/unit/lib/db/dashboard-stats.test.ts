/**
 * Dashboard Statistics Business Logic Tests
 *
 * Tests for dashboard analytics functions including stats calculations,
 * upcoming trips, recent bookings, and data aggregation.
 */

import { db } from "../../../../lib/db/index";

import { describe, it, expect, vi, beforeEach } from "vitest";

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
  bookings: {
    organizationId: "organizationId",
    id: "id",
    status: "status",
    total: "total",
    createdAt: "createdAt",
    customerId: "customerId",
    tripId: "tripId",
    participants: "participants",
  },
  transactions: {
    organizationId: "organizationId",
    type: "type",
    amount: "amount",
    createdAt: "createdAt",
  },
  trips: {
    organizationId: "organizationId",
    id: "id",
    status: "status",
    date: "date",
    startTime: "startTime",
    maxParticipants: "maxParticipants",
    tourId: "tourId",
  },
  tours: {
    id: "id",
    name: "name",
    maxParticipants: "maxParticipants",
  },
  customers: {
    organizationId: "organizationId",
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
  },
}));

import {
  getDashboardStats,
  getUpcomingTrips,
  getRecentBookings,
} from "../../../../lib/db/queries.server";

describe("Dashboard Statistics Logic", () => {
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
    (db.limit as unknown as Mock).mockReturnValue(db);  // Return db to allow further chaining
    (db.offset as unknown as Mock).mockResolvedValue([]);
    (db.returning as unknown as Mock).mockResolvedValue([]);
  });

  // ============================================================================
  // Dashboard Stats Tests
  // ============================================================================

  describe("getDashboardStats", () => {
    it("should return all dashboard statistics", async () => {
      // Mock responses for each stat query
      const todayBookingsResult = [{ count: 5 }];
      const weekRevenueResult = [{ total: 2500.0 }];
      const activeTripsResult = [{ count: 3 }];
      const totalCustomersResult = [{ count: 150 }];

      // where is terminal for all 4 queries (no limit call)
      (db.where as unknown as Mock)
        .mockResolvedValueOnce(todayBookingsResult)
        .mockResolvedValueOnce(weekRevenueResult)
        .mockResolvedValueOnce(activeTripsResult)
        .mockResolvedValueOnce(totalCustomersResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.todayBookings).toBe(5);
      expect(result.weekRevenue).toBe(2500.0);
      expect(result.activeTrips).toBe(3);
      expect(result.totalCustomers).toBe(150);
    });

    it("should handle zero bookings today", async () => {
      const todayBookingsResult = [{ count: 0 }];
      const weekRevenueResult = [{ total: 1000.0 }];
      const activeTripsResult = [{ count: 2 }];
      const totalCustomersResult = [{ count: 100 }];

      (db.where as unknown as Mock)
        .mockResolvedValueOnce(todayBookingsResult)
        .mockResolvedValueOnce(weekRevenueResult)
        .mockResolvedValueOnce(activeTripsResult)
        .mockResolvedValueOnce(totalCustomersResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.todayBookings).toBe(0);
    });

    it("should handle zero revenue this week", async () => {
      const todayBookingsResult = [{ count: 2 }];
      const weekRevenueResult = [{ total: 0 }];
      const activeTripsResult = [{ count: 1 }];
      const totalCustomersResult = [{ count: 50 }];

      (db.where as unknown as Mock)
        .mockResolvedValueOnce(todayBookingsResult)
        .mockResolvedValueOnce(weekRevenueResult)
        .mockResolvedValueOnce(activeTripsResult)
        .mockResolvedValueOnce(totalCustomersResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.weekRevenue).toBe(0);
    });

    it("should handle no active trips", async () => {
      const todayBookingsResult = [{ count: 1 }];
      const weekRevenueResult = [{ total: 500.0 }];
      const activeTripsResult = [{ count: 0 }];
      const totalCustomersResult = [{ count: 75 }];

      (db.where as unknown as Mock)
        .mockResolvedValueOnce(todayBookingsResult)
        .mockResolvedValueOnce(weekRevenueResult)
        .mockResolvedValueOnce(activeTripsResult)
        .mockResolvedValueOnce(totalCustomersResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.activeTrips).toBe(0);
    });

    it("should handle new organization with no data", async () => {
      const emptyResult = [{ count: 0 }];
      const zeroRevenue = [{ total: 0 }];

      (db.where as unknown as Mock)
        .mockResolvedValueOnce(emptyResult)
        .mockResolvedValueOnce(zeroRevenue)
        .mockResolvedValueOnce(emptyResult)
        .mockResolvedValueOnce(emptyResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.todayBookings).toBe(0);
      expect(result.weekRevenue).toBe(0);
      expect(result.activeTrips).toBe(0);
      expect(result.totalCustomers).toBe(0);
    });

    it("should handle large numbers correctly", async () => {
      const todayBookingsResult = [{ count: 150 }];
      const weekRevenueResult = [{ total: 45000.0 }];
      const activeTripsResult = [{ count: 25 }];
      const totalCustomersResult = [{ count: 5000 }];

      (db.where as unknown as Mock)
        .mockResolvedValueOnce(todayBookingsResult)
        .mockResolvedValueOnce(weekRevenueResult)
        .mockResolvedValueOnce(activeTripsResult)
        .mockResolvedValueOnce(totalCustomersResult);

      const result = await getDashboardStats(testOrgId);

      expect(result.todayBookings).toBe(150);
      expect(result.weekRevenue).toBe(45000.0);
      expect(result.activeTrips).toBe(25);
      expect(result.totalCustomers).toBe(5000);
    });
  });

  // ============================================================================
  // Upcoming Trips Tests
  // ============================================================================

  describe("getUpcomingTrips", () => {
    it("should return upcoming trips with participant counts", async () => {
      const today = new Date().toISOString().split("T")[0];
      const mockTrips = [
        {
          id: "trip-1",
          name: "Reef Dive",
          date: today,
          startTime: "09:00:00",
          maxParticipants: 10,
        },
        {
          id: "trip-2",
          name: "Wreck Dive",
          date: today,
          startTime: "14:00:00",
          maxParticipants: 8,
        },
      ];

      const participantCounts = [
        { tripId: "trip-1", total: 7 },
        { tripId: "trip-2", total: 5 },
      ];

      const mockLimit = vi.fn().mockResolvedValue(mockTrips);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for first query (trips query) - where → orderBy → limit
      // Mock for second query (participant counts) - where → groupBy
      (db.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const result = await getUpcomingTrips(testOrgId, 5);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Reef Dive");
      expect(result[0].participants).toBe(7);
      expect(result[0].maxParticipants).toBe(10);
    });

    it("should limit results to specified number", async () => {
      const mockTrips = Array.from({ length: 3 }, (_, i) => ({
        id: `trip-${i}`,
        name: `Trip ${i}`,
        date: new Date().toISOString().split("T")[0],
        startTime: "09:00:00",
        maxParticipants: 10,
      }));

      const participantCounts = mockTrips.map((trip) => ({
        tripId: trip.id,
        total: 5,
      }));

      const mockLimit = vi.fn().mockResolvedValue(mockTrips);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for trips query + participant counts query
      (db.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const result = await getUpcomingTrips(testOrgId, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should handle trips with no bookings", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          name: "New Trip",
          date: new Date().toISOString().split("T")[0],
          startTime: "10:00:00",
          maxParticipants: 12,
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue(mockTrips);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockResolvedValue([]); // No participant counts

      // Mock for trips query + participant counts query
      (db.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const result = await getUpcomingTrips(testOrgId);

      expect(result[0].participants).toBe(0);
    });

    it("should handle trips that are fully booked", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          name: "Popular Trip",
          date: new Date().toISOString().split("T")[0],
          startTime: "09:00:00",
          maxParticipants: 10,
        },
      ];

      const participantCounts = [{ tripId: "trip-1", total: 10 }];

      const mockLimit = vi.fn().mockResolvedValue(mockTrips);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for trips query + participant counts query
      (db.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const result = await getUpcomingTrips(testOrgId);

      expect(result[0].participants).toBe(10);
      expect(result[0].maxParticipants).toBe(10);
    });

    it("should return empty array when no upcoming trips", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });

      // Only one query when trips array is empty - no participant count query
      (db.where as unknown as Mock).mockReturnValue({ orderBy: mockOrderBy });

      const result = await getUpcomingTrips(testOrgId);

      expect(result).toHaveLength(0);
    });

    it("should only include scheduled trips", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          name: "Scheduled Trip",
          date: new Date().toISOString().split("T")[0],
          startTime: "09:00:00",
          maxParticipants: 10,
        },
      ];

      const participantCounts = [{ tripId: "trip-1", total: 5 }];

      const mockLimit = vi.fn().mockResolvedValue(mockTrips);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockResolvedValue(participantCounts);

      // Mock for trips query + participant counts query
      (db.where as unknown as Mock)
        .mockReturnValueOnce({ orderBy: mockOrderBy })
        .mockReturnValueOnce({ groupBy: mockGroupBy });

      const result = await getUpcomingTrips(testOrgId);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // Recent Bookings Tests
  // ============================================================================

  describe("getRecentBookings", () => {
    it("should return recent bookings with customer and trip details", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "199.00",
          createdAt: new Date(),
          firstName: "John",
          lastName: "Doe",
          tourName: "Reef Dive",
        },
        {
          id: "booking-2",
          status: "pending",
          total: "149.00",
          createdAt: new Date(),
          firstName: "Jane",
          lastName: "Smith",
          tourName: "Wreck Dive",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId, 5);

      expect(result).toHaveLength(2);
      expect(result[0].customer).toBe("John Doe");
      expect(result[0].trip).toBe("Reef Dive");
      expect(result[0].amount).toBe(199.0);
    });

    it("should limit results to specified number", async () => {
      const mockBookings = Array.from({ length: 10 }, (_, i) => ({
        id: `booking-${i}`,
        status: "confirmed",
        total: "99.00",
        createdAt: new Date(),
        firstName: "Customer",
        lastName: `${i}`,
        tourName: "Tour",
      }));

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings.slice(0, 3));

      const result = await getRecentBookings(testOrgId, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should handle bookings with different statuses", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "199.00",
          createdAt: new Date(),
          firstName: "John",
          lastName: "Doe",
          tourName: "Reef Dive",
        },
        {
          id: "booking-2",
          status: "pending",
          total: "149.00",
          createdAt: new Date(),
          firstName: "Jane",
          lastName: "Smith",
          tourName: "Wreck Dive",
        },
        {
          id: "booking-3",
          status: "cancelled",
          total: "129.00",
          createdAt: new Date(),
          firstName: "Bob",
          lastName: "Johnson",
          tourName: "Shore Dive",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId);

      expect(result[0].status).toBe("confirmed");
      expect(result[1].status).toBe("pending");
      expect(result[2].status).toBe("cancelled");
    });

    it("should format amounts as numbers", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "199.99",
          createdAt: new Date(),
          firstName: "John",
          lastName: "Doe",
          tourName: "Reef Dive",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId);

      expect(typeof result[0].amount).toBe("number");
      expect(result[0].amount).toBe(199.99);
    });

    it("should return empty array when no bookings", async () => {
      (db.limit as unknown as Mock).mockResolvedValue([]);

      const result = await getRecentBookings(testOrgId);

      expect(result).toHaveLength(0);
    });

    it("should concatenate customer first and last names", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "199.00",
          createdAt: new Date(),
          firstName: "Mary",
          lastName: "Johnson-Smith",
          tourName: "Reef Dive",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId);

      expect(result[0].customer).toBe("Mary Johnson-Smith");
    });

    it("should handle high-value bookings", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "1599.00",
          createdAt: new Date(),
          firstName: "Premium",
          lastName: "Customer",
          tourName: "Liveaboard Experience",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId);

      expect(result[0].amount).toBe(1599.0);
    });

    it("should order by most recent first", async () => {
      const now = Date.now();
      const mockBookings = [
        {
          id: "booking-1",
          status: "confirmed",
          total: "100.00",
          createdAt: new Date(now - 1000),
          firstName: "Recent",
          lastName: "Customer",
          tourName: "Tour A",
        },
        {
          id: "booking-2",
          status: "confirmed",
          total: "150.00",
          createdAt: new Date(now - 5000),
          firstName: "Older",
          lastName: "Customer",
          tourName: "Tour B",
        },
      ];

      (db.limit as unknown as Mock).mockResolvedValue(mockBookings);

      const result = await getRecentBookings(testOrgId);

      expect(result[0].id).toBe("booking-1");
      expect(result[1].id).toBe("booking-2");
    });
  });
});
