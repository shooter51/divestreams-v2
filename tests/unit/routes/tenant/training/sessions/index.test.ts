/**
 * Sessions List Route Tests
 *
 * Tests the training sessions list page loader and component behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database and auth modules
const mockRequireOrgContext = vi.fn();
const mockGetCourseSessions = vi.fn();
const mockGetTrainingCourses = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getCourseSessions: mockGetCourseSessions,
  getTrainingCourses: mockGetTrainingCourses,
}));

describe("Training Sessions List Route", () => {
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
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/sessions");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.sessions).toEqual([]);
    });

    it("returns sessions list for premium users", async () => {
      const mockSessions = [
        {
          session: {
            id: "session-1",
            courseId: "course-1",
            sessionType: "classroom",
            scheduledDate: "2024-03-15",
            startTime: "09:00",
            endTime: "12:00",
            location: "Shop Classroom",
            status: "scheduled",
            maxStudents: 6,
          },
          course: { id: "course-1", name: "Open Water Diver" },
        },
        {
          session: {
            id: "session-2",
            courseId: "course-1",
            sessionType: "pool",
            scheduledDate: "2024-03-16",
            startTime: "14:00",
            endTime: "17:00",
            location: "Community Pool",
            status: "scheduled",
            maxStudents: 6,
          },
          course: { id: "course-1", name: "Open Water Diver" },
        },
      ];

      const mockCourses = [
        {
          course: { id: "course-1", name: "Open Water Diver" },
          agency: { name: "PADI" },
          level: { name: "Open Water" },
        },
      ];

      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: mockCourses,
        total: 1,
        page: 1,
        totalPages: 1,
      });
      mockGetCourseSessions.mockResolvedValue(mockSessions);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/sessions");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].session.sessionType).toBe("classroom");
      expect(result.courses).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it("filters sessions by course when course param is provided", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/sessions?course=course-1"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Verify getCourseSessions was called with courseId filter
      expect(mockGetCourseSessions).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          courseId: "course-1",
        })
      );
    });

    it("filters sessions by status when status param is provided", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/sessions?status=scheduled"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Verify getCourseSessions was called with status filter
      expect(mockGetCourseSessions).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          status: "scheduled",
        })
      );
    });

    it("parses date range parameters from URL", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/sessions?dateFrom=2024-03-01&dateTo=2024-03-31"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.dateFrom).toBe("2024-03-01");
      expect(result.dateTo).toBe("2024-03-31");
      expect(mockGetCourseSessions).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          startDate: "2024-03-01",
          endDate: "2024-03-31",
        })
      );
    });

    it("parses search parameter from URL", async () => {
      const mockSessions = [
        {
          session: {
            id: "session-1",
            sessionType: "classroom",
            scheduledDate: "2024-03-15",
            startTime: "09:00",
            location: "Main Classroom",
            status: "scheduled",
          },
          course: { id: "course-1", name: "Open Water Diver" },
        },
        {
          session: {
            id: "session-2",
            sessionType: "pool",
            scheduledDate: "2024-03-16",
            startTime: "14:00",
            location: "Pool",
            status: "scheduled",
          },
          course: { id: "course-1", name: "Advanced Open Water" },
        },
      ];

      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue(mockSessions);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/sessions?search=open%20water"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.search).toBe("open water");
      // Both sessions should match "open water" in course name
      expect(result.sessions).toHaveLength(2);
    });

    it("parses view parameter from URL", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/sessions?view=calendar"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.view).toBe("calendar");
    });

    it("defaults view to list when not specified", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue([]);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/sessions");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.view).toBe("list");
    });

    it("sorts sessions by date", async () => {
      const mockSessions = [
        {
          session: {
            id: "session-2",
            sessionType: "pool",
            scheduledDate: "2024-03-20",
            startTime: "09:00",
            status: "scheduled",
          },
          course: { name: "Course A" },
        },
        {
          session: {
            id: "session-1",
            sessionType: "classroom",
            scheduledDate: "2024-03-15",
            startTime: "09:00",
            status: "scheduled",
          },
          course: { name: "Course B" },
        },
        {
          session: {
            id: "session-3",
            sessionType: "open_water",
            scheduledDate: "2024-03-18",
            startTime: "07:00",
            status: "scheduled",
          },
          course: { name: "Course A" },
        },
      ];

      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
      });

      mockGetTrainingCourses.mockResolvedValue({
        courses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      mockGetCourseSessions.mockResolvedValue(mockSessions);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training/sessions");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      // Should be sorted by date ascending
      expect(result.sessions[0].session.scheduledDate).toBe("2024-03-15");
      expect(result.sessions[1].session.scheduledDate).toBe("2024-03-18");
      expect(result.sessions[2].session.scheduledDate).toBe("2024-03-20");
    });
  });

  describe("component exports", () => {
    it("exports meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      expect(typeof module.meta).toBe("function");
    });

    it("exports loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      expect(typeof module.loader).toBe("function");
    });

    it("exports default component", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      expect(typeof module.default).toBe("function");
    });

    it("meta returns correct title", async () => {
      const { meta } = await import(
        "../../../../../../app/routes/tenant/training/sessions/index"
      );
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Sessions - Training - DiveStreams" }]);
    });
  });
});
