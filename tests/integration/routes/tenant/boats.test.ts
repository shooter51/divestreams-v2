import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";
import { loader } from "../../../../app/routes/tenant/boats/index";

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
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  boats: {
    id: "id",
    name: "name",
    type: "type",
    capacity: "capacity",
    registrationNumber: "registrationNumber",
    description: "description",
    amenities: "amenities",
    isActive: "isActive",
    organizationId: "organizationId",
  },
  trips: {
    id: "id",
    boatId: "boatId",
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
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  count: vi.fn(() => ({ type: "count" })),
}));

// Mock require-feature.server - requireFeature is a no-op in tests
vi.mock("../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../lib/plan-features", () => ({
  PLAN_FEATURES: { HAS_EQUIPMENT_BOATS: "has_equipment_boats" },
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/boats route", () => {
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
      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches boats with organization filter", async () => {
      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
    });

    it("filters by search when provided", async () => {
      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats?q=ocean");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("ocean");
    });

    it("returns formatted boat data", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Ocean Explorer",
          type: "Dive Boat",
          capacity: 12,
          registrationNumber: "FL-12345",
          description: "Fast dive boat with all amenities",
          amenities: ["GPS", "Showers", "Restroom"],
          isActive: true,
        },
      ];

      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ boatId: "boat-1", count: 15 }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.boats).toHaveLength(1);
      expect(result.boats[0]).toMatchObject({
        id: "boat-1",
        name: "Ocean Explorer",
        type: "Dive Boat",
        capacity: 12,
        registrationNumber: "FL-12345",
        description: "Fast dive boat with all amenities",
        amenities: ["GPS", "Showers", "Restroom"],
        isActive: true,
        tripCount: 15,
      });
    });

    it("returns empty array when no boats exist", async () => {
      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.boats).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.totalCapacity).toBe(0);
    });

    it("calculates statistics correctly", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Ocean Explorer",
          type: "Dive Boat",
          capacity: 12,
          registrationNumber: "FL-12345",
          description: "",
          amenities: [],
          isActive: true,
        },
        {
          id: "boat-2",
          name: "Wave Rider",
          type: "Dive Boat",
          capacity: 8,
          registrationNumber: "FL-12346",
          description: "",
          amenities: [],
          isActive: true,
        },
        {
          id: "boat-3",
          name: "Old Timer",
          type: "Dive Boat",
          capacity: 6,
          registrationNumber: "FL-12347",
          description: "",
          amenities: [],
          isActive: false,
        },
      ];

      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.total).toBe(3);
      expect(result.activeCount).toBe(2);
      expect(result.totalCapacity).toBe(20); // 12 + 8 (only active boats)
    });

    it("handles boats without optional fields", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Basic Boat",
          type: null,
          capacity: null,
          registrationNumber: null,
          description: null,
          amenities: null,
          isActive: null,
        },
      ];

      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.boats[0]).toMatchObject({
        id: "boat-1",
        name: "Basic Boat",
        type: "Dive Boat",
        capacity: 0,
        registrationNumber: "",
        description: "",
        amenities: [],
        isActive: true,
        tripCount: 0,
      });
    });

    it("returns isPremium from context", async () => {
      const mockBoatsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockTripsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsQuery;
        return mockTripsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.isPremium).toBe(false);
    });
  });
});
