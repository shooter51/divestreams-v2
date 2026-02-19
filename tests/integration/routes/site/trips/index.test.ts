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
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
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

describe("site/trips/index route", () => {
  const mockOrg = { id: "org-1", name: "Reef Divers", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  describe("loader", () => {
    it("throws 404 when organization not found", async () => {
      // Org lookup: select -> from -> where -> limit (terminal)
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
      // 1. Org lookup: limit is terminal
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg]) // org lookup
        .mockReturnValue(db); // trips query limit chains to offset

      // 2. Main trips query: offset is terminal
      (db.offset as Mock).mockResolvedValueOnce([]);

      // 3. Count query: where is terminal (the innerJoin->where after the main query)
      // The where calls: (1) org lookup, (2) main trips query, (3) count query
      (db.where as Mock)
        .mockReturnValueOnce(db) // org lookup where -> chains to limit
        .mockReturnValueOnce(db) // main trips where -> chains to orderBy
        .mockResolvedValueOnce([{ count: 0 }]); // count query where (terminal)

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

      // 1. Org lookup: limit terminal
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg]) // org lookup
        .mockReturnValueOnce(db) // main trips query limit -> chains to offset
        .mockResolvedValueOnce([{ url: "https://cdn.example.com/reef.jpg" }]); // image query limit terminal

      // 2. Main trips query: offset terminal
      (db.offset as Mock).mockResolvedValueOnce([mockTripRow]);

      // 3. where calls:
      //   (1) org lookup -> chain
      //   (2) main trips query -> chain
      //   (3) count query -> terminal
      //   (4) booking count for trip-1 -> terminal
      //   (5) image query for trip-1 -> chain to limit
      (db.where as Mock)
        .mockReturnValueOnce(db) // org lookup
        .mockReturnValueOnce(db) // main trips
        .mockResolvedValueOnce([{ count: 1 }]) // count query
        .mockResolvedValueOnce([{ total: 3 }]) // booking count
        .mockReturnValueOnce(db); // image query -> chain to limit

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
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockReturnValue(db);

      (db.offset as Mock).mockResolvedValueOnce([]);

      (db.where as Mock)
        .mockReturnValueOnce(db)
        .mockReturnValueOnce(db)
        .mockResolvedValueOnce([{ count: 0 }]);

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

      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg]) // org
        .mockReturnValueOnce(db) // trips query limit -> offset
        .mockResolvedValueOnce([]); // image query (no image)

      (db.offset as Mock).mockResolvedValueOnce([mockTripRow]);

      (db.where as Mock)
        .mockReturnValueOnce(db) // org
        .mockReturnValueOnce(db) // trips
        .mockResolvedValueOnce([{ count: 1 }]) // count
        .mockResolvedValueOnce([{ total: 4 }]) // booking count: 4 of 6
        .mockReturnValueOnce(db); // image where -> chain

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

      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg]) // org
        .mockReturnValueOnce(db) // trips limit -> offset
        .mockResolvedValueOnce([{ url: "https://cdn.example.com/wreck.jpg" }]); // image

      (db.offset as Mock).mockResolvedValueOnce([mockTripRow]);

      (db.where as Mock)
        .mockReturnValueOnce(db) // org
        .mockReturnValueOnce(db) // trips
        .mockResolvedValueOnce([{ count: 1 }]) // count
        .mockResolvedValueOnce([{ total: 0 }]) // booking
        .mockReturnValueOnce(db); // image where -> chain

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips[0].primaryImage).toBe("https://cdn.example.com/wreck.jpg");
    });

    it("defaults fromDate to today when not specified", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockReturnValue(db);

      (db.offset as Mock).mockResolvedValueOnce([]);

      (db.where as Mock)
        .mockReturnValueOnce(db)
        .mockReturnValueOnce(db)
        .mockResolvedValueOnce([{ count: 0 }]);

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      const today = new Date().toISOString().split("T")[0];
      expect(result.fromDate).toBe(today);
      expect(result.toDate).toBeNull();
    });

    it("parses page query parameter", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockReturnValue(db);

      (db.offset as Mock).mockResolvedValueOnce([]);

      (db.where as Mock)
        .mockReturnValueOnce(db)
        .mockReturnValueOnce(db)
        .mockResolvedValueOnce([{ count: 0 }]);

      const request = new Request("https://demo.divestreams.com/site/trips?page=3");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(3);
    });

    it("defaults page to 1 for invalid page param", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockReturnValue(db);

      (db.offset as Mock).mockResolvedValueOnce([]);

      (db.where as Mock)
        .mockReturnValueOnce(db)
        .mockReturnValueOnce(db)
        .mockResolvedValueOnce([{ count: 0 }]);

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

      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg]) // org
        .mockReturnValueOnce(db) // trips limit -> offset
        .mockResolvedValueOnce([]); // image query: no image

      (db.offset as Mock).mockResolvedValueOnce([mockTripRow]);

      (db.where as Mock)
        .mockReturnValueOnce(db) // org
        .mockReturnValueOnce(db) // trips
        .mockResolvedValueOnce([{ count: 1 }]) // count
        .mockResolvedValueOnce([{ total: 0 }]) // booking
        .mockReturnValueOnce(db); // image where -> chain

      const request = new Request("https://demo.divestreams.com/site/trips");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.trips[0].primaryImage).toBeNull();
    });
  });
});
