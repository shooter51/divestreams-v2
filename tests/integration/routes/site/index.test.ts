import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies BEFORE importing
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  images: {
    entityId: "entityId",
    url: "url",
    organizationId: "organizationId",
    entityType: "entityType",
    isPrimary: "isPrimary",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  inArray: vi.fn((field: unknown, values: unknown) => ({ type: "inArray", field, values })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../lib/db/public-site.server", () => ({
  getPublicTrips: vi.fn().mockResolvedValue({ trips: [], total: 0 }),
  getPublicCourses: vi.fn().mockResolvedValue({ courses: [], total: 0 }),
}));

import { db } from "../../../../lib/db";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { getPublicTrips, getPublicCourses } from "../../../../lib/db/public-site.server";
import { loader } from "../../../../app/routes/site/index";

describe("site/index route", () => {
  const mockOrg = { id: "org-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chain implementations after clearAllMocks
    (db.select as Mock).mockImplementation(() => db);
    (db.from as Mock).mockImplementation(() => db);
    // where() returns an empty awaitable array with chain methods (for image query)
    (db.where as Mock).mockImplementation(() => Object.assign([], { limit: db.limit }));
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (getPublicTrips as Mock).mockResolvedValue({ trips: [], total: 0 });
    (getPublicCourses as Mock).mockResolvedValue({ courses: [], total: 0 });
  });

  describe("loader", () => {
    it("resolves organization and returns featured trips and courses", async () => {
      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(getSubdomainFromHost).toHaveBeenCalled();
      expect(getPublicTrips).toHaveBeenCalledWith("org-1", { limit: 4, page: 1 });
      expect(getPublicCourses).toHaveBeenCalledWith("org-1", { limit: 4, page: 1 });
      expect(result).toHaveProperty("featuredTrips");
      expect(result).toHaveProperty("featuredCourses");
    });

    it("returns empty arrays when no trips or courses exist", async () => {
      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.featuredTrips).toEqual([]);
      expect(result.featuredCourses).toEqual([]);
    });

    it("throws 404 when organization is not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://unknown.divestreams.com/site");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("maps trip data correctly with tour info", async () => {
      const mockTrips = {
        trips: [
          {
            id: "trip-1",
            date: "2025-06-15",
            startTime: "08:00",
            price: "150.00",
            tour: {
              id: "tour-1",
              name: "Reef Dive",
              description: "Amazing reef dive",
              type: "fun_dive",
              duration: 4,
              price: "150.00",
              currency: "USD",
            },
          },
        ],
        total: 1,
      };

      (getPublicTrips as Mock).mockResolvedValue(mockTrips);

      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.featuredTrips).toHaveLength(1);
      expect(result.featuredTrips[0]).toMatchObject({
        id: "trip-1",
        date: "2025-06-15",
        startTime: "08:00",
        price: "150.00",
        tour: {
          id: "tour-1",
          name: "Reef Dive",
        },
      });
    });

    it("maps course data correctly", async () => {
      const mockCourses = {
        courses: [
          {
            id: "course-1",
            name: "Open Water Diver",
            description: "Learn to dive",
            price: "500.00",
            currency: "USD",
            durationDays: 4,
          },
        ],
        total: 1,
      };

      (getPublicCourses as Mock).mockResolvedValue(mockCourses);

      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.featuredCourses).toHaveLength(1);
      expect(result.featuredCourses[0]).toMatchObject({
        id: "course-1",
        name: "Open Water Diver",
        price: "500.00",
        currency: "USD",
        durationDays: 4,
      });
    });

    it("falls back to custom domain when no subdomain", async () => {
      (getSubdomainFromHost as Mock).mockReturnValue(null);

      const request = new Request("https://customdomain.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result).toHaveProperty("featuredTrips");
    });
  });
});
