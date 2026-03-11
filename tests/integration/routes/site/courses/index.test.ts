import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  getPublicCourses: vi.fn().mockResolvedValue({ courses: [], total: 0 }),
}));

import { db } from "../../../../../lib/db";
import { getPublicCourses } from "../../../../../lib/db/public-site.server";
import { loader } from "../../../../../app/routes/site/courses/index";

describe("site/courses/index route", () => {
  const mockOrg = { id: "org-1", name: "Reef Divers", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.limit as Mock).mockResolvedValue([mockOrg]);
  });

  describe("loader", () => {
    it("throws 404 when organization not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/courses");

      try {
        await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns courses data with default filters", async () => {
      (getPublicCourses as Mock).mockResolvedValue({ courses: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/site/courses");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.courses).toEqual([]);
      expect(result.filters.agency).toBeNull();
      expect(result.filters.level).toBeNull();
      expect(result.page).toBe(1);
      expect(getPublicCourses).toHaveBeenCalledWith("org-1", { page: 1, limit: 100 });
    });

    it("applies agency and level filters", async () => {
      const mockCourses = [
        { id: "c1", name: "PADI Open Water", agencyName: "PADI", levelName: "Beginner", price: "400", currency: "USD", durationDays: 4, maxStudents: 6, minAge: 10, prerequisites: null, materialsIncluded: true, equipmentIncluded: true, images: null },
        { id: "c2", name: "SSI Advanced", agencyName: "SSI", levelName: "Advanced", price: "500", currency: "USD", durationDays: 3, maxStudents: 4, minAge: 15, prerequisites: "Open Water cert", materialsIncluded: true, equipmentIncluded: false, images: null },
      ];
      (getPublicCourses as Mock).mockResolvedValue({ courses: mockCourses, total: 2 });

      const request = new Request("https://demo.divestreams.com/site/courses?agency=padi&level=beginner");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.filters.agency).toBe("padi");
      expect(result.filters.level).toBe("beginner");
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].name).toBe("PADI Open Water");
    });

    it("paginates results correctly", async () => {
      const manyCourses = Array.from({ length: 15 }, (_, i) => ({
        id: `c${i}`,
        name: `Course ${i}`,
        agencyName: "PADI",
        levelName: "Beginner",
        price: "400",
        currency: "USD",
        durationDays: 3,
        maxStudents: 6,
        minAge: null,
        prerequisites: null,
        materialsIncluded: false,
        equipmentIncluded: false,
        images: null,
      }));
      (getPublicCourses as Mock).mockResolvedValue({ courses: manyCourses, total: 15 });

      const request = new Request("https://demo.divestreams.com/site/courses?page=2");

      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(2);
      expect(result.total).toBe(15);
      // Page 2 with limit 12 should return 3 items
      expect(result.courses).toHaveLength(3);
    });
  });
});
