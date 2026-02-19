import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../../lib/db/training.server", () => ({
  getCourses: vi.fn(),
  getAgencies: vi.fn(),
}));

// Mock use-notification (imported by the source file)
vi.mock("../../../../../lib/use-notification", () => ({
  useNotification: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getCourses, getAgencies } from "../../../../../lib/db/training.server";
import { loader } from "../../../../../app/routes/tenant/training/courses/index";

describe("tenant/training/courses/index route", () => {
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

  const mockAgencies = [
    { id: "agency-1", name: "PADI" },
    { id: "agency-2", name: "SSI" },
  ];

  const mockCourseList = [
    {
      id: "course-1",
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn the basics of scuba diving",
      images: ["https://example.com/owd.jpg"],
      agencyId: "agency-1",
      agencyName: "PADI",
      levelName: "Beginner",
      durationDays: 3,
      price: "399.00",
      currency: "USD",
      maxStudents: 6,
      isActive: true,
      isPublic: true,
    },
    {
      id: "course-2",
      name: "Advanced Open Water",
      code: "AOWD",
      description: "Advance your diving skills",
      images: [],
      agencyId: "agency-1",
      agencyName: "PADI",
      levelName: "Intermediate",
      durationDays: 2,
      price: "299.50",
      currency: "USD",
      maxStudents: 4,
      isActive: true,
      isPublic: false,
    },
    {
      id: "course-3",
      name: "Dive Master",
      code: "DM",
      description: "Become a professional diver",
      images: null,
      agencyId: "agency-2",
      agencyName: "SSI",
      levelName: "Professional",
      durationDays: 14,
      price: "1200.00",
      currency: "EUR",
      maxStudents: 2,
      isActive: false,
      isPublic: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCourses as Mock).mockResolvedValue(mockCourseList);
    (getAgencies as Mock).mockResolvedValue(mockAgencies);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns courses list and agencies", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(3);
      expect(result.agencies).toEqual(mockAgencies);
      expect(result.total).toBe(3);
      expect(getCourses).toHaveBeenCalledWith("org-uuid");
      expect(getAgencies).toHaveBeenCalledWith("org-uuid");
    });

    it("filters courses by search term matching name", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?search=open+water");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(2);
      expect(result.courses.map((c: any) => c.id)).toEqual(["course-1", "course-2"]);
      expect(result.search).toBe("open water");
    });

    it("filters courses by search term matching code", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?search=DM");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].id).toBe("course-3");
    });

    it("filters courses by search term matching description", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?search=professional");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].id).toBe("course-3");
    });

    it("filters courses by agency", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?agency=agency-2");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].id).toBe("course-3");
      expect(result.agencyFilter).toBe("agency-2");
    });

    it("filters courses by active status", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?status=active");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(2);
      expect(result.courses.every((c: any) => c.isActive)).toBe(true);
      expect(result.statusFilter).toBe("active");
    });

    it("filters courses by inactive status", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?status=inactive");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].isActive).toBe(false);
      expect(result.courses[0].id).toBe("course-3");
    });

    it("combines multiple filters", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?search=open&agency=agency-1&status=active");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toHaveLength(2);
      expect(result.courses.map((c: any) => c.id)).toEqual(["course-1", "course-2"]);
    });

    it("transforms courses with default values for missing fields", async () => {
      const coursesWithNulls = [
        {
          id: "course-4",
          name: "Basic Course",
          code: null,
          description: null,
          images: null,
          agencyId: null,
          agencyName: null,
          levelName: null,
          durationDays: null,
          price: null,
          currency: null,
          maxStudents: null,
          isActive: null,
          isPublic: null,
        },
      ];
      (getCourses as Mock).mockResolvedValue(coursesWithNulls);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses[0]).toMatchObject({
        id: "course-4",
        name: "Basic Course",
        code: "",
        description: "",
        imageUrl: null,
        agencyName: "No Agency",
        levelName: "No Level",
        durationDays: 0,
        price: "0.00",
        currency: "USD",
        maxStudents: 0,
        isActive: true,
        isPublic: false,
      });
    });

    it("transforms courses with first image as imageUrl", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses[0].imageUrl).toBe("https://example.com/owd.jpg");
      expect(result.courses[1].imageUrl).toBeNull();
      expect(result.courses[2].imageUrl).toBeNull();
    });

    it("formats price as two decimal places", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses[0].price).toBe("399.00");
      expect(result.courses[1].price).toBe("299.50");
      expect(result.courses[2].price).toBe("1200.00");
    });

    it("returns empty courses when none match filters", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses?search=nonexistent");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns empty search params when not provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.search).toBe("");
      expect(result.agencyFilter).toBe("");
      expect(result.statusFilter).toBe("");
    });
  });
});
