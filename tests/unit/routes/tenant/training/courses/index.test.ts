/**
 * Courses List Route Tests
 *
 * Tests the training courses list page loader and component behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database and auth modules
const mockRequireOrgContext = vi.fn();
const mockGetTrainingCourses = vi.fn();
const mockGetCertificationAgencies = vi.fn();
const mockGetEnrollments = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getTrainingCourses: mockGetTrainingCourses,
  getCertificationAgencies: mockGetCertificationAgencies,
  getEnrollments: mockGetEnrollments,
}));

describe("Training Courses List Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.courses).toEqual([]);
    });

    it("returns courses list for premium users", async () => {
      const mockCourses = [
        {
          course: {
            id: "course-1",
            name: "Open Water Diver",
            description: "Entry level certification",
            price: "599.00",
            depositAmount: "150.00",
            isActive: true,
          },
          agency: { id: "agency-1", name: "PADI" },
          level: { id: "level-1", name: "Open Water" },
        },
        {
          course: {
            id: "course-2",
            name: "Advanced Open Water",
            description: "Next step certification",
            price: "450.00",
            depositAmount: null,
            isActive: true,
          },
          agency: { id: "agency-1", name: "PADI" },
          level: { id: "level-2", name: "Advanced" },
        },
      ];

      const mockAgencies = [
        { id: "agency-1", name: "PADI", code: "PADI" },
        { id: "agency-2", name: "SSI", code: "SSI" },
      ];

      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetCertificationAgencies.mockResolvedValue(mockAgencies);
      mockGetTrainingCourses.mockResolvedValue({
        courses: mockCourses,
        total: 2,
        page: 1,
        totalPages: 1,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 3,
        page: 1,
        totalPages: 1,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.courses).toHaveLength(2);
      expect(result.courses[0].course.name).toBe("Open Water Diver");
      expect(result.agencies).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters courses by agency when agency param is provided", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetCertificationAgencies.mockResolvedValue([]);
      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/courses?agency=agency-1"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Verify getTrainingCourses was called with agencyId filter
      expect(mockGetTrainingCourses).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          agencyId: "agency-1",
        })
      );
    });

    it("parses search parameter from URL", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetCertificationAgencies.mockResolvedValue([]);
      mockGetTrainingCourses.mockResolvedValue({
        courses: [
          {
            course: {
              id: "course-1",
              name: "Open Water Diver",
              description: "Entry level",
              price: "599.00",
              isActive: true,
            },
            agency: { name: "PADI" },
            level: { name: "Open Water" },
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      });
      mockGetEnrollments.mockResolvedValue({ total: 0 });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/courses?search=open"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.search).toBe("open");
    });

    it("handles pagination parameters", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetCertificationAgencies.mockResolvedValue([]);
      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 50,
        page: 3,
        totalPages: 3,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/courses?page=3"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetTrainingCourses).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          page: 3,
        })
      );
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(3);
    });

    it("includes student enrollment counts for each course", async () => {
      const mockCourses = [
        {
          course: {
            id: "course-1",
            name: "Open Water",
            price: "599.00",
            isActive: true,
          },
          agency: { name: "PADI" },
          level: { name: "Open Water" },
        },
      ];

      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetCertificationAgencies.mockResolvedValue([]);
      mockGetTrainingCourses.mockResolvedValue({
        courses: mockCourses,
        total: 1,
        page: 1,
        totalPages: 1,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 5, // 5 students enrolled
        page: 1,
        totalPages: 1,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.courses[0].studentCount).toBe(5);
    });
  });

  describe("component exports", () => {
    it("exports meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      expect(typeof module.meta).toBe("function");
    });

    it("exports loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      expect(typeof module.loader).toBe("function");
    });

    it("exports default component", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      expect(typeof module.default).toBe("function");
    });

    it("meta returns correct title", async () => {
      const { meta } = await import(
        "../../../../../../app/routes/tenant/training/courses/index"
      );
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Courses - Training - DiveStreams" }]);
    });
  });
});
