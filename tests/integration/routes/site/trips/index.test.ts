import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => {
  const dbObj: Record<string, unknown> = {};
  const methods = ["select", "from", "innerJoin", "where", "orderBy", "limit", "offset", "groupBy"];
  for (const m of methods) {
    dbObj[m] = vi.fn();
  }
  return { db: dbObj };
});

vi.mock("../../../../../lib/db/schema", () => ({
  trips: {
    id: "id",
    tourId: "tourId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    price: "price",
    organizationId: "organizationId",
    isPublic: "isPublic",
    status: "status",
  },
  tours: {
    id: "id",
    name: "name",
    description: "description",
    type: "type",
    maxParticipants: "maxParticipants",
    price: "price",
    currency: "currency",
    duration: "duration",
    minCertLevel: "minCertLevel",
    includesEquipment: "includesEquipment",
    includesMeals: "includesMeals",
    includesTransport: "includesTransport",
    isActive: "isActive",
  },
  bookings: {
    id: "id",
    tripId: "tripId",
    status: "status",
    participants: "participants",
  },
  images: {
    id: "id",
    url: "url",
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
    isPrimary: "isPrimary",
  },
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  lte: vi.fn((a, b) => ({ type: "lte", field: a, value: b })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", field: a, values: b })),
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
}));

vi.mock("../../../../../lib/db/translations.server", () => ({
  bulkGetContentTranslations: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

import { db } from "../../../../../lib/db";
import { loader } from "../../../../../app/routes/site/trips/index";

/**
 * Helper to reset all db method mocks to chainable (return db).
 * Individual tests then override specific terminal calls.
 */
function resetDbChain() {
  const methods = ["select", "from", "innerJoin", "where", "orderBy", "limit", "offset", "groupBy"];
  for (const m of methods) {
    (db[m as keyof typeof db] as Mock).mockReturnValue(db);
  }
}

/**
 * Setup mocks for the new batched query pattern:
 * 1. Org lookup: select->from->where->limit (terminal)
 * 2. Main trips: select->from->innerJoin->where->orderBy->limit->offset (terminal)
 * 3. Count query: select->from->innerJoin->where (terminal)
 * 4. Booking batch: select->from->where->groupBy (terminal) — runs in Promise.all
 * 5. Image batch: select->from->where (terminal) — runs in Promise.all
 *
 * With the new batched approach, queries 4 and 5 run once (not per-trip).
 */
function setupLoaderMocks(options: {
  org?: Record<string, unknown> | null;
  tripsData?: Record<string, unknown>[];
  totalCount?: number;
  bookingCounts?: Array<{ tripId: string; total: number }>;
  tourImages?: Array<{ entityId: string; url: string }>;
}) {
  const {
    org = { id: "org-1", name: "Reef Divers", slug: "demo" },
    tripsData = [],
    totalCount = 0,
    bookingCounts = [],
    tourImages = [],
  } = options;

  // Track call counts for each method to return different values
  let limitCallCount = 0;
  let whereCallCount = 0;
  let groupByCallCount = 0;

  (db.limit as Mock).mockImplementation(() => {
    limitCallCount++;
    if (limitCallCount === 1) {
      // Org lookup — terminal
      return org ? Promise.resolve([org]) : Promise.resolve([]);
    }
    // Main trips query limit -> chains to offset
    return db;
  });

  (db.offset as Mock).mockResolvedValue(tripsData);

  (db.where as Mock).mockImplementation(() => {
    whereCallCount++;
    if (whereCallCount <= 2) {
      // 1: org lookup where -> chain, 2: main trips where -> chain
      return db;
    }
    if (whereCallCount === 3) {
      // Count query -> terminal
      return Promise.resolve([{ count: totalCount }]);
    }
    if (whereCallCount === 4) {
      // Booking batch where -> chains to groupBy
      return db;
    }
    if (whereCallCount === 5) {
      // Image batch where -> terminal
      return Promise.resolve(tourImages);
    }
    return db;
  });

  (db.groupBy as Mock).mockImplementation(() => {
    groupByCallCount++;
    if (groupByCallCount === 1) {
      // Booking counts batch -> terminal
      return Promise.resolve(bookingCounts);
    }
    return db;
  });
}

describe("site/trips/index route", () => {
  const mockOrg = { id: "org-1", name: "Reef Divers", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  describe("loader", () => {
    it("throws 404 when organization not found", async () => {
      (db.limit as Mock).mockResolvedValueOnce([]);

      const request = new Request("https://demo.divestreams.com/site/trips");

      try {
        await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns empty trips array when none found", async () => {
      setupLoaderMocks({ org: mockOrg, tripsData: [], totalCount: 0 });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.organizationName).toBe("Reef Divers");
    });

    it("returns trips with pagination data", async () => {
      const mockTripRow = {
        id: "trip-1",
        tourId: "tour-1",
        tourName: "Morning Reef Dive",
        tourDescription: "Explore the reef",
        tourType: "single_dive",
        date: "2026-06-15",
        startTime: "08:00",
        endTime: "12:00",
        tripMaxParticipants: 10,
        tourMaxParticipants: 12,
        tripPrice: "99",
        tourPrice: "89",
        currency: "USD",
        duration: 240,
        minCertLevel: "Open Water",
        includesEquipment: true,
        includesMeals: false,
        includesTransport: false,
      };

      setupLoaderMocks({
        org: mockOrg,
        tripsData: [mockTripRow],
        totalCount: 1,
        bookingCounts: [{ tripId: "trip-1", total: 3 }],
        tourImages: [{ entityId: "tour-1", url: "https://cdn.example.com/reef.jpg" }],
      });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].id).toBe("trip-1");
      expect(result.trips[0].tourName).toBe("Morning Reef Dive");
      expect(result.trips[0].maxParticipants).toBe(10);
      expect(result.trips[0].availableSpots).toBe(7);
      expect(result.trips[0].price).toBe("99");
      expect(result.trips[0].currency).toBe("USD");
      expect(result.trips[0].primaryImage).toBe("https://cdn.example.com/reef.jpg");
      expect(result.trips[0].includesEquipment).toBe(true);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("applies date range filters from query params", async () => {
      setupLoaderMocks({ org: mockOrg, tripsData: [], totalCount: 0 });

      const request = new Request(
        "https://demo.divestreams.com/site/trips?from=2026-07-01&to=2026-07-31"
      );

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.fromDate).toBe("2026-07-01");
      expect(result.toDate).toBe("2026-07-31");
    });

    it("calculates available spots per trip", async () => {
      const mockTripRow = {
        id: "trip-1",
        tourId: "tour-1",
        tourName: "Night Dive",
        tourDescription: null,
        tourType: "night_dive",
        date: "2026-08-01",
        startTime: "19:00",
        endTime: "21:00",
        tripMaxParticipants: 6,
        tourMaxParticipants: 8,
        tripPrice: "120",
        tourPrice: "100",
        currency: "USD",
        duration: 120,
        minCertLevel: "Advanced",
        includesEquipment: false,
        includesMeals: false,
        includesTransport: false,
      };

      setupLoaderMocks({
        org: mockOrg,
        tripsData: [mockTripRow],
        totalCount: 1,
        bookingCounts: [{ tripId: "trip-1", total: 4 }],
        tourImages: [],
      });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].maxParticipants).toBe(6);
      expect(result.trips[0].availableSpots).toBe(2);
    });

    it("returns primary image for each trip", async () => {
      const mockTripRow = {
        id: "trip-2",
        tourId: "tour-2",
        tourName: "Wreck Dive",
        tourDescription: "Explore the wreck",
        tourType: "single_dive",
        date: "2026-09-01",
        startTime: "09:00",
        endTime: null,
        tripMaxParticipants: null,
        tourMaxParticipants: 10,
        tripPrice: null,
        tourPrice: "200",
        currency: "EUR",
        duration: 180,
        minCertLevel: null,
        includesEquipment: true,
        includesMeals: true,
        includesTransport: true,
      };

      setupLoaderMocks({
        org: mockOrg,
        tripsData: [mockTripRow],
        totalCount: 1,
        bookingCounts: [],
        tourImages: [{ entityId: "tour-2", url: "https://cdn.example.com/wreck.jpg" }],
      });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips[0].primaryImage).toBe("https://cdn.example.com/wreck.jpg");
    });

    it("defaults fromDate to today when not specified", async () => {
      setupLoaderMocks({ org: mockOrg, tripsData: [], totalCount: 0 });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      const today = new Date().toISOString().split("T")[0];
      expect(result.fromDate).toBe(today);
      expect(result.toDate).toBeNull();
    });

    it("parses page query parameter", async () => {
      setupLoaderMocks({ org: mockOrg, tripsData: [], totalCount: 0 });

      const request = new Request("https://demo.divestreams.com/site/trips?page=3");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(3);
    });

    it("defaults page to 1 for invalid page param", async () => {
      setupLoaderMocks({ org: mockOrg, tripsData: [], totalCount: 0 });

      const request = new Request("https://demo.divestreams.com/site/trips?page=-5");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(1);
    });

    it("returns null primaryImage when no image exists for trip", async () => {
      const mockTripRow = {
        id: "trip-3",
        tourId: "tour-3",
        tourName: "Snorkel Tour",
        tourDescription: null,
        tourType: "snorkel",
        date: "2026-10-01",
        startTime: "10:00",
        endTime: "13:00",
        tripMaxParticipants: 15,
        tourMaxParticipants: 20,
        tripPrice: "50",
        tourPrice: "45",
        currency: "USD",
        duration: 180,
        minCertLevel: null,
        includesEquipment: true,
        includesMeals: false,
        includesTransport: true,
      };

      setupLoaderMocks({
        org: mockOrg,
        tripsData: [mockTripRow],
        totalCount: 1,
        bookingCounts: [],
        tourImages: [], // No images
      });

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips[0].primaryImage).toBeNull();
    });
  });
});
