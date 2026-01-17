/**
 * Enrollments List Route - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireOrgContext = vi.fn();
const mockGetEnrollments = vi.fn();
const mockGetTrainingCourses = vi.fn();
const mockGetStudentProgress = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getEnrollments: mockGetEnrollments,
  getTrainingCourses: mockGetTrainingCourses,
  getStudentProgress: mockGetStudentProgress,
}));

describe("Enrollments List Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup for premium user
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      isPremium: true,
    });

    // Mock courses for filter dropdown
    mockGetTrainingCourses.mockResolvedValue({
      courses: [
        {
          course: {
            id: "course-1",
            name: "Open Water Diver",
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

    // Mock enrollments
    mockGetEnrollments.mockResolvedValue({
      enrollments: [
        {
          enrollment: {
            id: "enrollment-1",
            status: "in_progress",
            enrolledAt: new Date("2024-01-15"),
          },
          course: {
            id: "course-1",
            name: "Open Water Diver",
          },
          customer: {
            id: "customer-1",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        },
        {
          enrollment: {
            id: "enrollment-2",
            status: "certified",
            enrolledAt: new Date("2024-01-10"),
          },
          course: {
            id: "course-1",
            name: "Open Water Diver",
          },
          customer: {
            id: "customer-2",
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
        },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    });

    // Mock student progress
    mockGetStudentProgress.mockResolvedValue({
      progress: { total: 75 },
    });
  });

  describe("loader", () => {
    it("returns enrollments list for premium users", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.enrollments).toHaveLength(2);
      expect(result.enrollments[0].enrollment.id).toBe("enrollment-1");
      expect(result.enrollments[0].progress).toBe(75);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it("returns hasAccess: false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.enrollments).toHaveLength(0);
    });

    it("passes course filter to getEnrollments", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments?course=course-1"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetEnrollments).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          courseId: "course-1",
        })
      );
    });

    it("passes status filter to getEnrollments", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments?status=certified"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetEnrollments).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          status: "certified",
        })
      );
    });

    it("filters enrollments by search query on student name", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments?search=john"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Should filter to only John Doe
      expect(result.enrollments).toHaveLength(1);
      expect(result.enrollments[0].customer.firstName).toBe("John");
    });

    it("returns courses for filter dropdown", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].course.name).toBe("Open Water Diver");
    });

    it("handles pagination parameters", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments?page=2"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetEnrollments).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          page: 2,
        })
      );
    });

    it("gets progress for each enrollment", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/enrollments"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Should call getStudentProgress for each enrollment
      expect(mockGetStudentProgress).toHaveBeenCalledTimes(2);
      expect(mockGetStudentProgress).toHaveBeenCalledWith("org-1", "enrollment-1");
      expect(mockGetStudentProgress).toHaveBeenCalledWith("org-1", "enrollment-2");
    });
  });

  describe("component exports", () => {
    it("exports a default component", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe("function");
    });

    it("exports a loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );
      expect(module.loader).toBeDefined();
      expect(typeof module.loader).toBe("function");
    });

    it("exports a meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/enrollments/index"
      );
      expect(module.meta).toBeDefined();
      expect(typeof module.meta).toBe("function");

      const meta = module.meta({} as any);
      expect(meta).toContainEqual({
        title: "Enrollments - Training - DiveStreams",
      });
    });
  });
});
