import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/dive-sites/index";

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
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  diveSites: {
    id: "id",
    name: "name",
    description: "description",
    maxDepth: "maxDepth",
    difficulty: "difficulty",
    latitude: "latitude",
    longitude: "longitude",
    currentStrength: "currentStrength",
    highlights: "highlights",
    isActive: "isActive",
    organizationId: "organizationId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/dive-sites route", () => {
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
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches dive sites with organization filter", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.diveSites).toBeDefined();
    });

    it("filters by search when provided", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites?q=reef");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("reef");
    });

    it("filters by difficulty when provided", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites?difficulty=advanced");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.difficulty).toBe("advanced");
    });

    it("returns formatted dive site data", async () => {
      const mockDiveSites = [
        {
          id: "site-1",
          name: "Blue Lagoon",
          description: "Beautiful coral reef with diverse marine life",
          maxDepth: 30,
          difficulty: "intermediate",
          latitude: "25.1234",
          longitude: "-80.4567",
          currentStrength: "moderate",
          highlights: ["Coral Reef", "Sea Turtles", "Tropical Fish"],
          isActive: true,
        },
      ];

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockDiveSites),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.diveSites).toHaveLength(1);
      expect(result.diveSites[0]).toMatchObject({
        id: "site-1",
        name: "Blue Lagoon",
        maxDepth: 30,
        difficulty: "intermediate",
        coordinates: { lat: 25.1234, lng: -80.4567 },
        conditions: "moderate",
        highlights: ["Coral Reef", "Sea Turtles", "Tropical Fish"],
        isActive: true,
      });
    });

    it("returns empty array when no dive sites exist", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.diveSites).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("handles dive sites without optional fields", async () => {
      const mockDiveSites = [
        {
          id: "site-1",
          name: "Basic Site",
          description: null,
          maxDepth: null,
          difficulty: null,
          latitude: null,
          longitude: null,
          currentStrength: null,
          highlights: null,
          isActive: null,
        },
      ];

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockDiveSites),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.diveSites[0]).toMatchObject({
        id: "site-1",
        name: "Basic Site",
        maxDepth: 0,
        difficulty: "intermediate",
        coordinates: null,
        conditions: "",
        highlights: [],
        isActive: true,
      });
    });

    it("handles dive sites without coordinates", async () => {
      const mockDiveSites = [
        {
          id: "site-1",
          name: "No Location Site",
          description: "A site without GPS coordinates",
          maxDepth: 20,
          difficulty: "beginner",
          latitude: null,
          longitude: null,
          currentStrength: "light",
          highlights: [],
          isActive: true,
        },
      ];

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockDiveSites),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.diveSites[0].coordinates).toBeNull();
    });

    it("returns isPremium from context", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.isPremium).toBe(false);
    });

    it("filters by both search and difficulty", async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockSelectQuery);

      const request = new Request("https://demo.divestreams.com/app/dive-sites?q=reef&difficulty=expert");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("reef");
      expect(result.difficulty).toBe("expert");
    });
  });
});
