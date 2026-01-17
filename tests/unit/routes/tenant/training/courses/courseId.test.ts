/**
 * Course Detail Route Tests
 *
 * Tests the training course detail page loader and actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireOrgContext = vi.fn();
const mockGetTrainingCourseById = vi.fn();
const mockGetCourseSessions = vi.fn();
const mockGetEnrollments = vi.fn();
const mockDeleteTrainingCourse = vi.fn();
const mockUpdateTrainingCourse = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getTrainingCourseById: mockGetTrainingCourseById,
  getCourseSessions: mockGetCourseSessions,
  getEnrollments: mockGetEnrollments,
  deleteTrainingCourse: mockDeleteTrainingCourse,
  updateTrainingCourse: mockUpdateTrainingCourse,
}));

describe("Course Detail Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      isPremium: true,
    });
  });

  describe("loader", () => {
    it("returns course data when found", async () => {
      const mockCourse = {
        course: {
          id: "course-1",
          name: "Open Water Diver",
          description: "Learn to dive!",
          price: "500.00",
          depositAmount: "100.00",
          maxStudents: 6,
          scheduleType: "fixed",
          isActive: true,
          createdAt: new Date(),
        },
        agency: { id: "agency-1", name: "PADI", code: "PADI" },
        level: { id: "level-1", name: "Open Water", code: "OW" },
      };

      mockGetTrainingCourseById.mockResolvedValue(mockCourse);
      mockGetCourseSessions.mockResolvedValue([]);
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1"
      );
      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.course).toEqual(mockCourse);
      expect(mockGetTrainingCourseById).toHaveBeenCalledWith("org-1", "course-1");
    });

    it("throws 404 when course not found", async () => {
      mockGetTrainingCourseById.mockResolvedValue(null);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/nonexistent"
      );

      await expect(
        loader({
          request,
          params: { courseId: "nonexistent" },
          context: {},
        } as any)
      ).rejects.toThrow();
    });

    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1"
      );
      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.course).toBeNull();
    });

    it("throws 400 when courseId is missing", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/"
      );

      await expect(
        loader({
          request,
          params: {},
          context: {},
        } as any)
      ).rejects.toThrow();
    });

    it("loads upcoming sessions for the course", async () => {
      const mockCourse = {
        course: { id: "course-1", name: "OW", isActive: true, createdAt: new Date() },
        agency: { name: "PADI" },
        level: { name: "OW" },
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSessions = [
        {
          session: {
            id: "session-1",
            scheduledDate: futureDate.toISOString().split("T")[0],
            startTime: "09:00",
            sessionType: "classroom",
            status: "scheduled",
          },
          course: mockCourse.course,
        },
      ];

      mockGetTrainingCourseById.mockResolvedValue(mockCourse);
      mockGetCourseSessions.mockResolvedValue(mockSessions);
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1"
      );
      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result.upcomingSessions).toHaveLength(1);
      expect(mockGetCourseSessions).toHaveBeenCalledWith("org-1", {
        courseId: "course-1",
        status: "scheduled",
      });
    });

    it("loads recent enrollments for the course", async () => {
      const mockCourse = {
        course: { id: "course-1", name: "OW", isActive: true, createdAt: new Date() },
        agency: { name: "PADI" },
        level: { name: "OW" },
      };

      const mockEnrollments = [
        {
          enrollment: {
            id: "enroll-1",
            status: "in_progress",
            enrolledAt: new Date(),
          },
          customer: { firstName: "John", lastName: "Doe" },
          course: mockCourse.course,
        },
      ];

      mockGetTrainingCourseById.mockResolvedValue(mockCourse);
      mockGetCourseSessions.mockResolvedValue([]);
      mockGetEnrollments.mockResolvedValue({
        enrollments: mockEnrollments,
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1"
      );
      const result = await loader({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result.recentEnrollments).toHaveLength(1);
      expect(mockGetEnrollments).toHaveBeenCalledWith("org-1", {
        courseId: "course-1",
        limit: 5,
      });
    });
  });

  describe("action", () => {
    it("handles toggle-active intent", async () => {
      const mockCourse = {
        course: { id: "course-1", isActive: true },
      };
      mockGetTrainingCourseById.mockResolvedValue(mockCourse);
      mockUpdateTrainingCourse.mockResolvedValue({ ...mockCourse.course, isActive: false });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const formData = new FormData();
      formData.set("intent", "toggle-active");

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result).toEqual({ toggled: true });
      expect(mockUpdateTrainingCourse).toHaveBeenCalledWith("org-1", "course-1", {
        isActive: false,
      });
    });

    it("handles delete intent", async () => {
      mockDeleteTrainingCourse.mockResolvedValue(undefined);

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/$courseId"
      );

      const formData = new FormData();
      formData.set("intent", "delete");

      const request = new Request(
        "https://demo.divestreams.com/app/training/courses/course-1",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: { courseId: "course-1" },
        context: {},
      } as any);

      expect(result).toEqual({ deleted: true });
      expect(mockDeleteTrainingCourse).toHaveBeenCalledWith("org-1", "course-1");
    });
  });
});
