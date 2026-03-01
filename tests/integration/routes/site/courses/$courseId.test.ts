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

vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  getPublicCourseById: vi.fn(),
  getCourseScheduledTrips: vi.fn().mockResolvedValue({ trips: [], total: 0 }),
}));

import { db } from "../../../../../lib/db";
import { getSubdomainFromHost } from "../../../../../lib/utils/url";
import { getPublicCourseById, getCourseScheduledTrips } from "../../../../../lib/db/public-site.server";
import { loader } from "../../../../../app/routes/site/courses/$courseId";

describe("site/courses/$courseId route", () => {
  const mockOrg = { id: "org-1", name: "Reef Divers", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (db.limit as Mock).mockResolvedValue([mockOrg]);
  });

  describe("loader", () => {
    it("throws 400 when no courseId param", async () => {
      const request = new Request("https://demo.divestreams.com/site/courses/");

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

      const request = new Request("https://demo.divestreams.com/site/courses/course-1");

      try {
        await loader({
          request,
          params: { courseId: "course-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("throws 404 when course not found", async () => {
      (getPublicCourseById as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/site/courses/nonexistent");

      try {
        await loader({
          request,
          params: { courseId: "nonexistent" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns course detail data for valid request", async () => {
      const mockCourse = {
        id: "course-1",
        name: "PADI Open Water",
        description: "Learn to dive",
        durationDays: 4,
        classroomHours: 8,
        poolHours: 4,
        openWaterDives: 4,
        maxStudents: 6,
        minStudents: 2,
        price: "400",
        currency: "USD",
        depositRequired: false,
        depositAmount: null,
        materialsIncluded: true,
        equipmentIncluded: true,
        includedItems: null,
        requiredItems: null,
        minAge: 10,
        prerequisites: null,
        medicalRequirements: null,
        images: null,
        agencyName: "PADI",
        levelName: "Beginner",
      };

      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);
      (getCourseScheduledTrips as Mock).mockResolvedValue({ trips: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/site/courses/course-1");

      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.course.id).toBe("course-1");
      expect(result.course.name).toBe("PADI Open Water");
      expect(result.sessions).toEqual([]);
      expect(result.organizationSlug).toBe("demo");
    });

    it("returns sessions for the course", async () => {
      const mockCourse = {
        id: "course-1",
        name: "PADI Open Water",
        description: null,
        durationDays: 4,
        classroomHours: null,
        poolHours: null,
        openWaterDives: null,
        maxStudents: 6,
        minStudents: null,
        price: "400",
        currency: "USD",
        depositRequired: null,
        depositAmount: null,
        materialsIncluded: null,
        equipmentIncluded: null,
        includedItems: null,
        requiredItems: null,
        minAge: null,
        prerequisites: null,
        medicalRequirements: null,
        images: null,
        agencyName: null,
        levelName: null,
      };

      const mockSessions = [
        { id: "s1", date: "2026-04-01", startTime: "09:00", endTime: null, maxParticipants: 6, price: null, status: "scheduled" },
      ];

      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);
      (getCourseScheduledTrips as Mock).mockResolvedValue({ trips: mockSessions, total: 1 });

      const request = new Request("https://demo.divestreams.com/site/courses/course-1");

      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.sessions).toHaveLength(1);
      expect(result.totalSessions).toBe(1);
    });
  });
});
