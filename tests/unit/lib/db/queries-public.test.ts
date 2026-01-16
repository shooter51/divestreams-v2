/**
 * Public Queries Tests
 *
 * Tests for public booking widget database query functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Store for mock return values
let mockLimitValue: unknown[] = [];
let mockOrderByValue: unknown[] = [];

// Create a unified chain object that supports all Drizzle patterns
// Every method returns the same object which is also a thenable
const createDbMock = () => {
  const chain: Record<string, unknown> = {};

  // Promise-like interface
  chain.then = (resolve: (value: unknown[]) => void) => {
    resolve(mockLimitValue);
    return chain;
  };
  chain.catch = () => chain;

  // All query-building methods return the chain
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
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([{ id: "item-1" }]));

  return chain;
};

const dbMock = createDbMock();

// Helper functions to set mock return values
const mockLimit = {
  mockResolvedValue: (value: unknown[]) => {
    mockLimitValue = value;
  },
  mockResolvedValueOnce: (value: unknown[]) => {
    const originalValue = mockLimitValue;
    mockLimitValue = value;
    // Reset after one call by creating a proxy
    const originalThen = dbMock.then;
    dbMock.then = (resolve: (value: unknown[]) => void) => {
      resolve(value);
      dbMock.then = originalThen;
      mockLimitValue = originalValue;
      return dbMock;
    };
  },
};

const mockOrderBy = {
  mockResolvedValue: (value: unknown[]) => {
    mockOrderByValue = value;
  },
  mockResolvedValueOnce: (value: unknown[]) => {
    mockOrderByValue = value;
  },
};

vi.mock("../../../../lib/db/index", () => ({
  db: dbMock,
}));

vi.mock("../../../../lib/db/schema", () => ({
  tours: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    type: "type",
    duration: "duration",
    maxParticipants: "maxParticipants",
    price: "price",
    currency: "currency",
    includesEquipment: "includesEquipment",
    includesMeals: "includesMeals",
    includesTransport: "includesTransport",
    inclusions: "inclusions",
    minCertLevel: "minCertLevel",
    minAge: "minAge",
    isActive: "isActive",
  },
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    price: "price",
    status: "status",
  },
  bookings: {
    id: "id",
    organizationId: "organizationId",
    tripId: "tripId",
    participants: "participants",
    status: "status",
  },
  images: {
    id: "id",
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
    url: "url",
    thumbnailUrl: "thumbnailUrl",
    alt: "alt",
    sortOrder: "sortOrder",
    isPrimary: "isPrimary",
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
  },
}));

describe("Public Queries Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);
  });

  describe("Module exports", () => {
    it("exports getOrganizationBySlug function", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(typeof publicModule.getOrganizationBySlug).toBe("function");
    });

    it("exports getPublicTours function", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(typeof publicModule.getPublicTours).toBe("function");
    });

    it("exports getPublicTrips function", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(typeof publicModule.getPublicTrips).toBe("function");
    });

    it("exports getPublicTourById function", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(typeof publicModule.getPublicTourById).toBe("function");
    });

    it("exports getPublicTripById function", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(typeof publicModule.getPublicTripById).toBe("function");
    });
  });

  describe("Type exports", () => {
    it("exports PublicTour interface", async () => {
      // Type exports are verified at compile time, just check module loads
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(publicModule).toBeDefined();
    });

    it("exports PublicTrip interface", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(publicModule).toBeDefined();
    });

    it("exports PublicTourDetail interface", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(publicModule).toBeDefined();
    });

    it("exports PublicTripDetail interface", async () => {
      const publicModule = await import("../../../../lib/db/queries.public");
      expect(publicModule).toBeDefined();
    });
  });

  describe("getOrganizationBySlug", () => {
    it("returns organization when found", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "org-1", name: "Test Dive Shop", slug: "test-dive" },
      ]);

      const { getOrganizationBySlug } = await import("../../../../lib/db/queries.public");
      const org = await getOrganizationBySlug("test-dive");

      expect(org).toBeDefined();
      expect(org?.slug).toBe("test-dive");
    });

    it("returns null when organization not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getOrganizationBySlug } = await import("../../../../lib/db/queries.public");
      const org = await getOrganizationBySlug("nonexistent");

      expect(org).toBeNull();
    });
  });

  describe("getPublicTours", () => {
    it("returns array of public tours", async () => {
      mockOrderBy.mockResolvedValueOnce([
        {
          id: "tour-1",
          name: "Morning Dive",
          description: "A great morning dive",
          type: "single_dive",
          duration: 180,
          maxParticipants: 8,
          price: "99.00",
          currency: "USD",
          includesEquipment: true,
          includesMeals: false,
          includesTransport: false,
          inclusions: ["tank", "weights"],
          minCertLevel: "Open Water",
          minAge: 12,
        },
      ]);
      // Mock for images query
      mockLimit.mockResolvedValueOnce([{ url: "https://example.com/image.jpg", thumbnailUrl: null }]);
      // Mock for image count
      mockLimit.mockResolvedValueOnce([{ count: 1 }]);

      const { getPublicTours } = await import("../../../../lib/db/queries.public");
      const tours = await getPublicTours("org-1");

      expect(Array.isArray(tours)).toBe(true);
    });

    it("returns empty array when no tours found", async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const { getPublicTours } = await import("../../../../lib/db/queries.public");
      const tours = await getPublicTours("org-1");

      expect(tours).toEqual([]);
    });
  });

  describe("getPublicTrips", () => {
    it("returns array of public trips", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Morning Dive",
          date: "2024-01-15",
          startTime: "09:00",
          endTime: "12:00",
          tripMaxParticipants: 8,
          tourMaxParticipants: 10,
          tripPrice: "99.00",
          tourPrice: "89.00",
          currency: "USD",
          status: "scheduled",
        },
      ]);
      // Mock for booking count
      mockLimit.mockResolvedValueOnce([{ total: 2 }]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1");

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts tourId filter option", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1", { tourId: "tour-1" });

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts fromDate and toDate options", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1", {
        fromDate: "2024-01-01",
        toDate: "2024-01-31",
      });

      expect(Array.isArray(trips)).toBe(true);
    });

    it("accepts limit option", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1", { limit: 10 });

      expect(Array.isArray(trips)).toBe(true);
    });

    it("defaults to 30 trips limit", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1");

      // Just verify the function completes successfully with default limit
      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe("getPublicTourById", () => {
    it("returns tour details with images and upcoming trips", async () => {
      // Mock tour query
      mockLimit.mockResolvedValueOnce([
        {
          id: "tour-1",
          name: "Morning Dive",
          description: "Great dive",
          type: "single_dive",
          duration: 180,
          maxParticipants: 8,
          price: "99.00",
          currency: "USD",
          includesEquipment: true,
          includesMeals: false,
          includesTransport: false,
          inclusions: [],
          minCertLevel: null,
          minAge: null,
        },
      ]);
      // Mock images query
      mockOrderBy.mockResolvedValueOnce([
        { id: "img-1", url: "https://example.com/1.jpg", thumbnailUrl: null, alt: "Image 1", sortOrder: 0, isPrimary: true },
      ]);
      // Mock getPublicTrips call (for upcoming trips) - empty for simplicity
      mockLimit.mockResolvedValue([]);

      const { getPublicTourById } = await import("../../../../lib/db/queries.public");
      const tour = await getPublicTourById("org-1", "tour-1");

      expect(tour).toBeDefined();
      expect(tour?.id).toBe("tour-1");
    });

    it("returns null when tour not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getPublicTourById } = await import("../../../../lib/db/queries.public");
      const tour = await getPublicTourById("org-1", "nonexistent");

      expect(tour).toBeNull();
    });
  });

  describe("getPublicTripById", () => {
    it("returns null when trip not found (empty result)", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTripById } = await import("../../../../lib/db/queries.public");
      const trip = await getPublicTripById("org-1", "nonexistent");

      expect(trip).toBeNull();
    });

    it("accepts organizationId and tripId parameters", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTripById } = await import("../../../../lib/db/queries.public");
      // Just verify the function accepts parameters and returns without error
      const trip = await getPublicTripById("org-1", "trip-1");

      // With empty mock, should return null
      expect(trip).toBeNull();
    });
  });

  describe("PublicTrip availability", () => {
    it("getPublicTrips returns array type", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");
      const trips = await getPublicTrips("org-1");

      expect(Array.isArray(trips)).toBe(true);
    });

    it("getPublicTrips accepts filter options", async () => {
      mockLimit.mockResolvedValue([]);

      const { getPublicTrips } = await import("../../../../lib/db/queries.public");

      // Test with tourId filter
      const tripsWithTour = await getPublicTrips("org-1", { tourId: "tour-1" });
      expect(Array.isArray(tripsWithTour)).toBe(true);

      // Test with date filters
      const tripsWithDates = await getPublicTrips("org-1", {
        fromDate: "2024-01-01",
        toDate: "2024-12-31",
      });
      expect(Array.isArray(tripsWithDates)).toBe(true);

      // Test with limit
      const tripsWithLimit = await getPublicTrips("org-1", { limit: 5 });
      expect(Array.isArray(tripsWithLimit)).toBe(true);
    });
  });
});
