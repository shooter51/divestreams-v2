/**
 * Training Dashboard Route Tests
 *
 * Tests for the training dashboard at /app/training
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
const mockRequireOrgContext = vi.fn();
const mockGetTrainingDashboardStats = vi.fn();
const mockGetEnrollments = vi.fn();
const mockGetCourseSessions = vi.fn();

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getTrainingDashboardStats: mockGetTrainingDashboardStats,
  getEnrollments: mockGetEnrollments,
  getCourseSessions: mockGetCourseSessions,
}));

describe("Training Dashboard Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
        limits: {},
      });

      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.stats).toBeNull();
      expect(result.recentEnrollments).toBeNull();
      expect(result.upcomingSessions).toBeNull();
    });

    it("returns dashboard stats for premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      const mockStats = {
        activeEnrollments: 5,
        completedThisMonth: 3,
        upcomingSessions: 8,
        availableCourses: 4,
      };

      mockGetTrainingDashboardStats.mockResolvedValue(mockStats);
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      // Re-import to get fresh module with mocks
      vi.resetModules();
      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );

      const request = new Request("https://demo.divestreams.com/app/training");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.stats).toEqual(mockStats);
    });

    it("returns recent enrollments", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      const mockEnrollments = [
        {
          enrollment: { id: "enroll-1", status: "in_progress" },
          course: { name: "Open Water" },
          customer: { firstName: "John", lastName: "Doe" },
        },
        {
          enrollment: { id: "enroll-2", status: "certified" },
          course: { name: "Advanced Open Water" },
          customer: { firstName: "Jane", lastName: "Smith" },
        },
      ];

      mockGetTrainingDashboardStats.mockResolvedValue({
        activeEnrollments: 2,
        completedThisMonth: 1,
        upcomingSessions: 0,
        availableCourses: 2,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: mockEnrollments,
        total: 2,
        page: 1,
        totalPages: 1,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );

      const request = new Request("https://demo.divestreams.com/app/training");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.recentEnrollments).toHaveLength(2);
      expect(result.recentEnrollments?.[0].customer?.firstName).toBe("John");
    });

    it("filters upcoming sessions to next 7 days", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const mockSessions = [
        {
          session: {
            id: "session-1",
            scheduledDate: tomorrow.toISOString().split("T")[0],
            startTime: "09:00",
            sessionType: "pool",
            location: "Pool A",
            status: "scheduled",
          },
          course: { name: "Open Water" },
        },
        {
          session: {
            id: "session-2",
            scheduledDate: nextMonth.toISOString().split("T")[0],
            startTime: "10:00",
            sessionType: "classroom",
            location: "Room 1",
            status: "scheduled",
          },
          course: { name: "Advanced" },
        },
      ];

      mockGetTrainingDashboardStats.mockResolvedValue({
        activeEnrollments: 0,
        completedThisMonth: 0,
        upcomingSessions: 2,
        availableCourses: 2,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue(mockSessions);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );

      const request = new Request("https://demo.divestreams.com/app/training");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Only the session within 7 days should be included
      expect(result.upcomingSessions).toHaveLength(1);
      expect(result.upcomingSessions?.[0].session.id).toBe("session-1");
    });

    it("calls getEnrollments with limit of 5", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockGetTrainingDashboardStats.mockResolvedValue({
        activeEnrollments: 0,
        completedThisMonth: 0,
        upcomingSessions: 0,
        availableCourses: 0,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );

      const request = new Request("https://demo.divestreams.com/app/training");
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetEnrollments).toHaveBeenCalledWith("org-1", { limit: 5 });
    });

    it("calls getCourseSessions with status filter", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockGetTrainingDashboardStats.mockResolvedValue({
        activeEnrollments: 0,
        completedThisMonth: 0,
        upcomingSessions: 0,
        availableCourses: 0,
      });
      mockGetEnrollments.mockResolvedValue({
        enrollments: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../app/routes/tenant/training/index"
      );

      const request = new Request("https://demo.divestreams.com/app/training");
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetCourseSessions).toHaveBeenCalledWith("org-1", {
        status: "scheduled",
      });
    });
  });

  describe("component exports", () => {
    it("exports default component", async () => {
      const module = await import(
        "../../../../../app/routes/tenant/training/index"
      );
      expect(typeof module.default).toBe("function");
    });

    it("exports meta function", async () => {
      const module = await import(
        "../../../../../app/routes/tenant/training/index"
      );
      expect(typeof module.meta).toBe("function");
    });

    it("exports loader function", async () => {
      const module = await import(
        "../../../../../app/routes/tenant/training/index"
      );
      expect(typeof module.loader).toBe("function");
    });
  });
});
