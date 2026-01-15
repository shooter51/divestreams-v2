import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/bookings/index";

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
    customerId: "customerId",
    tripId: "tripId",
    participants: "participants",
    total: "total",
    paidAmount: "paidAmount",
    status: "status",
    createdAt: "createdAt",
  },
  customers: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
  },
  trips: {
    id: "id",
    tourId: "tourId",
    date: "date",
    startTime: "startTime",
  },
  tours: {
    id: "id",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  count: vi.fn(() => ({ type: "count" })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/bookings route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 5 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      // Mock for bookings list query
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      // Mock for total count query
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      // Mock for monthly count query
      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches bookings with organization filter", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.bookings).toBeDefined();
    });

    it("filters by status when provided", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings?status=confirmed");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.status).toBe("confirmed");
    });

    it("paginates correctly", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 100 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings?page=3");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(3);
      expect(mockBookingsQuery.offset).toHaveBeenCalled();
    });

    it("returns formatted bookings with customer info", async () => {
      const today = new Date();
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "customer-1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Morning Dive",
          tripDate: today,
          tripTime: "08:00",
          participants: 2,
          total: 150.0,
          status: "confirmed",
          paidAmount: 150.0,
          createdAt: new Date("2024-01-10"),
        },
      ];

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toMatchObject({
        id: "booking-1",
        bookingNumber: "BK-001",
        customer: {
          id: "customer-1",
          firstName: "John",
          lastName: "Smith",
          email: "john@example.com",
        },
        trip: {
          id: "trip-1",
          tourName: "Morning Dive",
          startTime: "08:00",
        },
        participants: 2,
        total: "150.00",
        status: "confirmed",
        paidAmount: "150.00",
      });
    });

    it("returns stats with today's bookings count", async () => {
      const today = new Date();
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "customer-1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Morning Dive",
          tripDate: today,
          tripTime: "08:00",
          participants: 2,
          total: 150.0,
          status: "confirmed",
          paidAmount: 150.0,
          createdAt: new Date(),
        },
      ];

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stats).toBeDefined();
      expect(result.stats.today).toBe(1);
      expect(result.stats.upcoming).toBe(1);
    });

    it("calculates pending payment count correctly", async () => {
      const today = new Date();
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "c1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Dive",
          tripDate: today,
          tripTime: "08:00",
          participants: 1,
          total: 100.0,
          status: "confirmed",
          paidAmount: 50.0, // Partial payment
          createdAt: new Date(),
        },
        {
          id: "booking-2",
          bookingNumber: "BK-002",
          customerId: "c2",
          customerFirstName: "Jane",
          customerLastName: "Doe",
          customerEmail: "jane@example.com",
          tripId: "trip-2",
          tourName: "Dive",
          tripDate: today,
          tripTime: "10:00",
          participants: 1,
          total: 100.0,
          status: "cancelled", // Cancelled - should not count
          paidAmount: 0,
          createdAt: new Date(),
        },
      ];

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 2 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 2 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stats.pendingPayment).toBe(1);
    });

    it("returns empty array when no bookings exist", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.bookings).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.stats.today).toBe(0);
      expect(result.stats.upcoming).toBe(0);
      expect(result.stats.pendingPayment).toBe(0);
    });

    it("returns pagination info", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 100 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings?page=2");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
    });

    it("returns search and status filter values", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings?search=john&status=pending");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("john");
      expect(result.status).toBe("pending");
    });

    it("returns freemium data", async () => {
      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      const mockMonthlyCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 8 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBookingsQuery;
        if (selectCallCount === 2) return mockCountQuery;
        return mockMonthlyCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.canAddBooking).toBe(true);
      expect(result.usage).toBe(8);
      expect(result.limit).toBe(20);
      expect(result.isPremium).toBe(false);
    });
  });
});
