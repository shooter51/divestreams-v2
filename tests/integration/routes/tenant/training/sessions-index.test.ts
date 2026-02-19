import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getSessions: vi.fn(),
  getCourses: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(),
  useNotification: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSessions, getCourses } from "../../../../../lib/db/training.server";
import { loader } from "../../../../../app/routes/tenant/training/sessions/index";

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

describe("tenant/training/sessions/index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getSessions as Mock).mockResolvedValue([]);
    (getCourses as Mock).mockResolvedValue([]);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns sessions list", async () => {
      const mockSessions = [
        {
          id: "session-1",
          courseId: "course-1",
          courseName: "Open Water Diver",
          startDate: "2026-03-01",
          status: "scheduled",
          enrolledCount: 3,
          maxStudents: 8,
        },
        {
          id: "session-2",
          courseId: "course-2",
          courseName: "Advanced Open Water",
          startDate: "2026-03-15",
          status: "in_progress",
          enrolledCount: 5,
          maxStudents: 6,
        },
      ];
      (getSessions as Mock).mockResolvedValue(mockSessions);

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.sessions).toEqual(mockSessions);
      expect(result.total).toBe(2);
    });

    it("returns courses for filter dropdown", async () => {
      const mockCourses = [
        { id: "course-1", name: "Open Water Diver" },
        { id: "course-2", name: "Advanced Open Water" },
      ];
      (getCourses as Mock).mockResolvedValue(mockCourses);

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courses).toEqual(mockCourses);
    });

    it("filters by courseId query param", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions?courseId=course-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getSessions).toHaveBeenCalledWith("org-uuid", {
        courseId: "course-1",
        status: undefined,
      });
      expect(result.courseId).toBe("course-1");
    });

    it("filters by status query param", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions?status=scheduled");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getSessions).toHaveBeenCalledWith("org-uuid", {
        courseId: undefined,
        status: "scheduled",
      });
      expect(result.status).toBe("scheduled");
    });

    it("passes both filters when both are provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions?courseId=course-1&status=completed");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getSessions).toHaveBeenCalledWith("org-uuid", {
        courseId: "course-1",
        status: "completed",
      });
    });

    it("returns empty string for courseId and status when not provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.courseId).toBe("");
      expect(result.status).toBe("");
    });

    it("returns isPremium from context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.isPremium).toBe(false);
    });

    it("returns isPremium true when context has premium", async () => {
      (requireOrgContext as Mock).mockResolvedValue({ ...mockOrgContext, isPremium: true });

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.isPremium).toBe(true);
    });
  });
});
