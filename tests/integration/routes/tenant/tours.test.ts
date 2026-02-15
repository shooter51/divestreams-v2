import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";
import { loader } from "../../../../app/routes/tenant/tours/index";

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
  tours: {
    id: "id",
    name: "name",
    description: "description",
    type: "type",
    duration: "duration",
    maxParticipants: "maxParticipants",
    price: "price",
    currency: "currency",
    minCertLevel: "minCertLevel",
    isActive: "isActive",
    createdAt: "createdAt",
    organizationId: "organizationId",
  },
  trips: {
    id: "id",
    tourId: "tourId",
    organizationId: "organizationId",
  },
  images: {
    id: "id",
    entityType: "entityType",
    entityId: "entityId",
    url: "url",
    organizationId: "organizationId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  count: vi.fn(() => ({ type: "count" })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/tours route", () => {
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
      // Mock for tour list query
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      // Mock for trip counts query
      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      // Mock for total count query - must return an array with value property
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches tours with organization filter", async () => {
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.tours).toBeDefined();
    });

    it("filters by search when provided", async () => {
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours?search=morning");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("morning");
    });

    it("filters by type when provided", async () => {
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours?type=single_dive");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.typeFilter).toBe("single_dive");
    });

    it("returns formatted tour data", async () => {
      const mockTours = [
        {
          id: "tour-1",
          name: "Morning Dive",
          description: "Beautiful morning dive",
          type: "single_dive",
          duration: 180,
          maxParticipants: 8,
          price: "99.00",
          currency: "USD",
          minCertLevel: "Open Water",
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTours),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ tourId: "tour-1", count: 5 }]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.tours).toHaveLength(1);
      expect(result.tours[0]).toMatchObject({
        id: "tour-1",
        name: "Morning Dive",
        type: "single_dive",
        duration: 180,
        maxParticipants: 8,
        price: "99.00",
        currency: "USD",
        minCertLevel: "Open Water",
        isActive: true,
        tripCount: 5,
      });
    });

    it("returns empty array when no tours exist", async () => {
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.tours).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns freemium data", async () => {
      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 2 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.canAddTour).toBe(true);
      expect(result.limit).toBe(3);
      expect(result.isPremium).toBe(false);
    });

    it("handles tours without optional fields", async () => {
      const mockTours = [
        {
          id: "tour-1",
          name: "Basic Tour",
          description: null,
          type: null,
          duration: null,
          maxParticipants: null,
          price: null,
          currency: null,
          minCertLevel: null,
          isActive: null,
          createdAt: new Date(),
        },
      ];

      const mockToursQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTours),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockToursQuery;
        if (selectCallCount === 2) return mockTripsQuery;
        return mockCountQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/tours");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.tours[0]).toMatchObject({
        id: "tour-1",
        name: "Basic Tour",
        type: "other",
        duration: 0,
        maxParticipants: 0,
        price: "0.00",
        currency: "USD",
        minCertLevel: null,
        isActive: true,
        tripCount: 0,
      });
    });
  });
});
