/**
 * Tests for Edit Course Route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockRequireOrgContext = vi.fn();
const mockGetCertificationAgencies = vi.fn();
const mockGetCertificationLevels = vi.fn();
const mockGetTrainingCourseById = vi.fn();
const mockUpdateTrainingCourse = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getCertificationAgencies: mockGetCertificationAgencies,
  getCertificationLevels: mockGetCertificationLevels,
  getTrainingCourseById: mockGetTrainingCourseById,
  updateTrainingCourse: mockUpdateTrainingCourse,
}));

// Mock react-router redirect
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url: string) => ({ redirect: url })),
  };
});

describe("Edit Course Route", () => {
  const mockCourse = {
    course: {
      id: "course-123",
      name: "PADI Open Water",
      description: "Learn to dive!",
      agencyId: "agency-1",
      levelId: "level-1",
      scheduleType: "fixed",
      price: "599.00",
      depositAmount: "100.00",
      maxStudents: 6,
      totalSessions: 5,
      hasExam: true,
      examPassScore: 75,
      minOpenWaterDives: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    agency: { id: "agency-1", name: "PADI", code: "PADI" },
    level: { id: "level-1", name: "Open Water Diver", code: "OW" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      isPremium: true,
    });
    mockGetCertificationAgencies.mockResolvedValue([
      { id: "agency-1", name: "PADI", code: "PADI" },
      { id: "agency-2", name: "SSI", code: "SSI" },
    ]);
    mockGetCertificationLevels.mockResolvedValue([
      {
        level: { id: "level-1", name: "Open Water Diver", code: "OW", agencyId: "agency-1" },
        agency: { id: "agency-1", name: "PADI" },
      },
      {
        level: { id: "level-2", name: "Advanced Open Water", code: "AOW", agencyId: "agency-1" },
        agency: { id: "agency-1", name: "PADI" },
      },
    ]);
    mockGetTrainingCourseById.mockResolvedValue(mockCourse);
    mockUpdateTrainingCourse.mockResolvedValue({
      ...mockCourse.course,
      name: "Updated Course Name",
    });
  });

  describe("loader", () => {
    it("returns course data with agencies and levels for premium users", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit");
      const result = await loader({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.course).toEqual(mockCourse);
      expect(result.agencies).toHaveLength(2);
      expect(result.levels).toHaveLength(2);
    });

    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit");
      const result = await loader({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.course).toBe(null);
    });

    it("throws 404 when course not found", async () => {
      mockGetTrainingCourseById.mockResolvedValue(null);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/nonexistent/edit");

      await expect(
        loader({
          request,
          params: { courseId: "nonexistent" },
          context: {},
        } as any)
      ).rejects.toThrow();
    });

    it("throws 400 when courseId is missing", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/edit");

      await expect(
        loader({
          request,
          params: {},
          context: {},
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("updates a course with valid data", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );

      const formData = new FormData();
      formData.append("name", "Updated PADI Open Water");
      formData.append("description", "Updated description");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("scheduleType", "fixed");
      formData.append("price", "649.00");
      formData.append("depositAmount", "150.00");
      formData.append("maxStudents", "8");
      formData.append("totalSessions", "6");
      formData.append("hasExam", "true");
      formData.append("examPassScore", "80");
      formData.append("minOpenWaterDives", "4");

      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(mockUpdateTrainingCourse).toHaveBeenCalledWith("org-1", "course-123", {
        name: "Updated PADI Open Water",
        description: "Updated description",
        agencyId: "agency-1",
        levelId: "level-1",
        scheduleType: "fixed",
        price: "649.00",
        depositAmount: "150.00",
        maxStudents: 8,
        totalSessions: 6,
        hasExam: true,
        examPassScore: 80,
        minOpenWaterDives: 4,
      });

      expect(result).toEqual({ redirect: "/app/training/courses/course-123" });
    });

    it("returns validation errors for missing required fields", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );

      const formData = new FormData();
      formData.append("name", "");
      formData.append("agencyId", "");
      formData.append("levelId", "");
      formData.append("price", "");

      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(result.errors).toBeDefined();
      expect(result.errors.name).toBe("Course name is required");
      expect(result.errors.agencyId).toBe("Certification agency is required");
      expect(result.errors.levelId).toBe("Certification level is required");
      expect(result.errors.price).toBe("Valid price is required");
      expect(mockUpdateTrainingCourse).not.toHaveBeenCalled();
    });

    it("returns error for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );

      const formData = new FormData();
      formData.append("name", "Updated Course");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("price", "599.00");

      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(result.errors.general).toContain("premium feature");
      expect(mockUpdateTrainingCourse).not.toHaveBeenCalled();
    });

    it("handles database errors gracefully", async () => {
      mockUpdateTrainingCourse.mockRejectedValue(new Error("Database error"));

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );

      const formData = new FormData();
      formData.append("name", "Updated Course");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("price", "599.00");

      const request = new Request("https://demo.divestreams.com/app/training/courses/course-123/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { courseId: "course-123" },
        context: {},
      } as any);

      expect(result.errors.general).toContain("Failed to update course");
    });

    it("returns error when courseId is missing", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId.edit"
      );

      const formData = new FormData();
      formData.append("name", "Updated Course");

      const request = new Request("https://demo.divestreams.com/app/training/courses/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.errors.general).toBe("Course ID required");
    });
  });
});
