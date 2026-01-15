import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/trips/index";

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
    groupBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  trips: {
    id: "id",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    status: "status",
    tourId: "tourId",
    boatId: "boatId",
    organizationId: "organizationId",
  },
  tours: {
    id: "id",
    name: "name",
    price: "price",
  },
  boats: {
    id: "id",
    name: "name",
  },
  bookings: {
    id: "id",
    tripId: "tripId",
    participants: "participants",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  gte: vi.fn((field, value) => ({ type: "gte", field, value })),
  lt: vi.fn((field, value) => ({ type: "lt", field, value })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/trips route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
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
      // When there are no trips, the booking query is skipped
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches upcoming trips by default", async () => {
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.view).toBe("upcoming");
    });

    it("fetches past trips when view=past", async () => {
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips?view=past");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.view).toBe("past");
    });

    it("filters by tourId when provided", async () => {
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips?tourId=tour-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.tourId).toBe("tour-1");
    });

    it("returns empty array when no trips exist", async () => {
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.trips).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns formatted trip data with tour and boat info", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: futureDateStr,
          startTime: "08:00",
          endTime: "12:00",
          maxParticipants: 8,
          status: "open",
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ tripId: "trip-1", count: 3 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.trips).toHaveLength(1);
      expect(result.trips[0]).toMatchObject({
        id: "trip-1",
        date: futureDateStr,
        startTime: "08:00",
        endTime: "12:00",
        maxParticipants: 8,
        bookedParticipants: 3,
        tour: { id: "tour-1", name: "Morning Dive" },
        boat: { id: "boat-1", name: "Ocean Explorer" },
      });
    });

    it("marks trip as full when booked equals max participants", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: futureDateStr,
          startTime: "08:00",
          endTime: "12:00",
          maxParticipants: 8,
          status: "open",
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ tripId: "trip-1", count: 8 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.trips[0].status).toBe("full");
    });

    it("groups trips by date", async () => {
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 7);
      const date1Str = futureDate1.toISOString().split("T")[0];

      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 8);
      const date2Str = futureDate2.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: date1Str,
          startTime: "08:00",
          endTime: "12:00",
          maxParticipants: 8,
          status: "open",
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
        {
          id: "trip-2",
          date: date2Str,
          startTime: "14:00",
          endTime: "18:00",
          maxParticipants: 6,
          status: "open",
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(Object.keys(result.tripsByDate)).toHaveLength(2);
      expect(result.tripsByDate[date1Str]).toHaveLength(1);
      expect(result.tripsByDate[date2Str]).toHaveLength(1);
    });

    it("calculates revenue correctly", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: futureDateStr,
          startTime: "08:00",
          endTime: "12:00",
          maxParticipants: 8,
          status: "open",
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "100.00",
          boatName: "Ocean Explorer",
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ tripId: "trip-1", count: 5 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // 5 participants * $100 = $500.00
      expect(result.trips[0].revenue).toBe("500.00");
    });

    it("handles trips without tour or boat", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: futureDateStr,
          startTime: "08:00",
          endTime: null,
          maxParticipants: null,
          status: "open",
          tourId: null,
          boatId: null,
          tourName: null,
          tourPrice: null,
          boatName: null,
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.trips[0].tour.name).toBe("Unknown Tour");
      expect(result.trips[0].boat.name).toBe("TBD");
      expect(result.trips[0].endTime).toBe("");
      expect(result.trips[0].maxParticipants).toBe(0);
    });

    it("returns isPremium from context", async () => {
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockTripsQuery);

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.isPremium).toBe(false);
    });

    it("filters out completed trips from upcoming view", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockTrips = [
        {
          id: "trip-1",
          date: futureDateStr,
          startTime: "08:00",
          endTime: "12:00",
          maxParticipants: 8,
          status: "completed", // Should be filtered out from upcoming view
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Morning Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
        {
          id: "trip-2",
          date: futureDateStr,
          startTime: "14:00",
          endTime: "18:00",
          maxParticipants: 8,
          status: "open", // Should be included
          tourId: "tour-1",
          boatId: "boat-1",
          tourName: "Afternoon Dive",
          tourPrice: "99.00",
          boatName: "Ocean Explorer",
        },
      ];

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      };

      const mockBookingsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockTripsQuery;
        return mockBookingsQuery;
      });

      const request = new Request("https://demo.divestreams.com/app/trips");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].id).toBe("trip-2");
    });
  });
});
