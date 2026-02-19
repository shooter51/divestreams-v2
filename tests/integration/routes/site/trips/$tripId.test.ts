import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

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
    boatId: "boatId",
    weatherNotes: "weatherNotes",
    notes: "notes",
  },
  tours: {
    id: "id",
    name: "name",
    description: "description",
    type: "type",
    maxParticipants: "maxParticipants",
    minParticipants: "minParticipants",
    price: "price",
    currency: "currency",
    duration: "duration",
    minCertLevel: "minCertLevel",
    minAge: "minAge",
    includesEquipment: "includesEquipment",
    includesMeals: "includesMeals",
    includesTransport: "includesTransport",
    inclusions: "inclusions",
    exclusions: "exclusions",
    requirements: "requirements",
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
    thumbnailUrl: "thumbnailUrl",
    alt: "alt",
    sortOrder: "sortOrder",
    isPrimary: "isPrimary",
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
  },
  boats: { id: "id", name: "name", capacity: "capacity" },
  diveSites: {
    id: "id",
    name: "name",
    description: "description",
    maxDepth: "maxDepth",
    minDepth: "minDepth",
    difficulty: "difficulty",
    highlights: "highlights",
  },
  tourDiveSites: {
    tourId: "tourId",
    diveSiteId: "diveSiteId",
    order: "order",
  },
}));

vi.mock("../../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
  },
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
}));

import { db } from "../../../../../lib/db";
import { getSubdomainFromHost } from "../../../../../lib/utils/url";
import { loader } from "../../../../../app/routes/site/trips/$tripId";

describe("site/trips/$tripId route", () => {
  const mockOrg = { id: "org-1", name: "Reef Divers", slug: "demo" };

  const futureDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();

  const mockTripData = {
    id: "trip-1",
    tourId: "tour-1",
    tourName: "Reef Adventure",
    tourDescription: "Amazing reef dive",
    tourType: "single_dive",
    date: futureDate,
    startTime: "08:00",
    endTime: "16:00",
    tripMaxParticipants: 10,
    tourMaxParticipants: 12,
    minParticipants: 2,
    tripPrice: "150",
    tourPrice: "120",
    currency: "USD",
    duration: 480,
    minCertLevel: "Open Water",
    minAge: 12,
    includesEquipment: true,
    includesMeals: true,
    includesTransport: false,
    inclusions: ["Tank & air"],
    exclusions: ["Tips"],
    requirements: ["Valid certification"],
    boatId: "boat-1",
    weatherNotes: "Clear skies expected",
    notes: "Bring sunscreen",
    isPublic: true,
    status: "scheduled",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
  });

  describe("loader", () => {
    it("throws 400 when no tripId param", async () => {
      const request = new Request("https://demo.divestreams.com/site/trips/");

      try {
        await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when organization not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      try {
        await loader({
          request,
          params: { tripId: "trip-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("throws 404 when trip not found", async () => {
      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        // Trip query returns empty
        return Promise.resolve([]);
      });

      const request = new Request("https://demo.divestreams.com/site/trips/nonexistent");

      try {
        await loader({
          request,
          params: { tripId: "nonexistent" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("throws 404 when trip is in the past", async () => {
      const pastDate = "2020-01-01";
      const pastTrip = { ...mockTripData, date: pastDate };

      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([pastTrip]);
        return Promise.resolve([]);
      });

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      try {
        await loader({
          request,
          params: { tripId: "trip-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        const text = await (error as Response).text();
        expect(text).toBe("This trip has already passed");
      }
    });

    it("returns trip detail with all data when found", async () => {
      const mockImages = [
        { id: "img-1", url: "https://cdn.example.com/reef.jpg", thumbnailUrl: "https://cdn.example.com/reef-thumb.jpg", alt: "Reef", sortOrder: 0, isPrimary: true },
        { id: "img-2", url: "https://cdn.example.com/reef2.jpg", thumbnailUrl: null, alt: "Reef 2", sortOrder: 1, isPrimary: false },
      ];

      const mockSites = [
        { id: "site-1", name: "Coral Garden", description: "Beautiful corals", maxDepth: 18, minDepth: 5, difficulty: "beginner", highlights: ["Coral", "Fish"], order: 1 },
        { id: "site-2", name: "The Wall", description: "Dramatic wall dive", maxDepth: 40, minDepth: 12, difficulty: "advanced", highlights: ["Sharks"], order: 2 },
      ];

      // Call sequence:
      // 1. org lookup -> limit
      // 2. trip+tour join -> limit
      // 3. booking count -> where (terminal, no limit)
      // 4. boat info -> limit (boatId exists)
      // 5. tour images -> orderBy (terminal)
      // 6. dive sites -> orderBy (terminal)
      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([mockTripData]);
        if (limitCallCount === 3) return Promise.resolve([{ name: "Sea Explorer", capacity: 20 }]);
        return Promise.resolve([]);
      });

      // booking count query ends at where (no limit/orderBy)
      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        // The 3rd where call is the booking count query (after org where + trip where)
        if (whereCallCount === 3) return Promise.resolve([{ total: 3 }]);
        return db;
      });

      let orderByCallCount = 0;
      (db.orderBy as Mock).mockImplementation(() => {
        orderByCallCount++;
        if (orderByCallCount === 1) return Promise.resolve(mockImages);
        if (orderByCallCount === 2) return Promise.resolve(mockSites);
        return Promise.resolve([]);
      });

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      // Trip data
      expect(result.trip.id).toBe("trip-1");
      expect(result.trip.tourName).toBe("Reef Adventure");
      expect(result.trip.tourDescription).toBe("Amazing reef dive");
      expect(result.trip.tourType).toBe("single_dive");
      expect(result.trip.date).toBe(futureDate);
      expect(result.trip.startTime).toBe("08:00");
      expect(result.trip.endTime).toBe("16:00");
      expect(result.trip.price).toBe("150");
      expect(result.trip.currency).toBe("USD");
      expect(result.trip.duration).toBe(480);
      expect(result.trip.minCertLevel).toBe("Open Water");
      expect(result.trip.minAge).toBe(12);
      expect(result.trip.includesEquipment).toBe(true);
      expect(result.trip.includesMeals).toBe(true);
      expect(result.trip.includesTransport).toBe(false);
      expect(result.trip.inclusions).toEqual(["Tank & air"]);
      expect(result.trip.exclusions).toEqual(["Tips"]);
      expect(result.trip.requirements).toEqual(["Valid certification"]);
      expect(result.trip.weatherNotes).toBe("Clear skies expected");
      expect(result.trip.notes).toBe("Bring sunscreen");

      // Boat info
      expect(result.trip.boatName).toBe("Sea Explorer");
      expect(result.trip.boatCapacity).toBe(20);

      // Images
      expect(result.images).toHaveLength(2);
      expect(result.images[0].isPrimary).toBe(true);
      expect(result.images[0].url).toBe("https://cdn.example.com/reef.jpg");

      // Dive sites
      expect(result.diveSites).toHaveLength(2);
      expect(result.diveSites[0].name).toBe("Coral Garden");
      expect(result.diveSites[0].difficulty).toBe("beginner");
      expect(result.diveSites[0].highlights).toEqual(["Coral", "Fish"]);
      expect(result.diveSites[1].name).toBe("The Wall");
      expect(result.diveSites[1].order).toBe(2);

      // Org info
      expect(result.organizationName).toBe("Reef Divers");
      expect(result.organizationSlug).toBe("demo");
    });

    it("calculates available spots correctly", async () => {
      // Trip has maxParticipants=10, booked=7 -> 3 available
      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([{ ...mockTripData, boatId: null }]);
        return Promise.resolve([]);
      });

      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        // Booking count query is the 3rd where call
        if (whereCallCount === 3) return Promise.resolve([{ total: 7 }]);
        return db;
      });

      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.trip.maxParticipants).toBe(10);
      expect(result.trip.bookedCount).toBe(7);
      expect(result.trip.availableSpots).toBe(3);
    });

    it("returns empty diveSites when none exist", async () => {
      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([{ ...mockTripData, boatId: null }]);
        return Promise.resolve([]);
      });

      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 3) return Promise.resolve([{ total: 0 }]);
        return db;
      });

      // Both images and dive sites return empty
      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.diveSites).toEqual([]);
    });

    it("returns null boatName when no boat assigned", async () => {
      const tripNoBoat = { ...mockTripData, boatId: null };

      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([tripNoBoat]);
        // No boat query will be made since boatId is null
        return Promise.resolve([]);
      });

      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 3) return Promise.resolve([{ total: 0 }]);
        return db;
      });

      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.trip.boatName).toBeNull();
      expect(result.trip.boatCapacity).toBeNull();
    });

    it("uses tripMaxParticipants when available over tourMaxParticipants", async () => {
      const tripWithOverride = {
        ...mockTripData,
        tripMaxParticipants: 8,
        tourMaxParticipants: 12,
        boatId: null,
      };

      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([tripWithOverride]);
        return Promise.resolve([]);
      });

      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 3) return Promise.resolve([{ total: 2 }]);
        return db;
      });

      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.trip.maxParticipants).toBe(8);
      expect(result.trip.availableSpots).toBe(6);
    });

    it("clamps available spots to zero when overbooked", async () => {
      const tripSmall = {
        ...mockTripData,
        tripMaxParticipants: 5,
        tourMaxParticipants: 5,
        boatId: null,
      };

      let limitCallCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([mockOrg]);
        if (limitCallCount === 2) return Promise.resolve([tripSmall]);
        return Promise.resolve([]);
      });

      let whereCallCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCallCount++;
        // Booked more than max
        if (whereCallCount === 3) return Promise.resolve([{ total: 8 }]);
        return db;
      });

      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/trips/trip-1");

      const result = await loader({
        request,
        params: { tripId: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.trip.availableSpots).toBe(0);
      expect(result.trip.bookedCount).toBe(8);
    });
  });
});
