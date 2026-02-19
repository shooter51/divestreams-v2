import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../../lib/db/training.server", () => ({
  getTrainingDashboardStats: vi.fn(),
  getUpcomingTrainingSessions: vi.fn(),
  getRecentEnrollments: vi.fn(),
}));

// Mock require-feature.server
vi.mock("../../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  PLAN_FEATURES: { HAS_TRAINING: "has_training" },
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../../lib/require-feature.server";
import {
  getTrainingDashboardStats,
  getUpcomingTrainingSessions,
  getRecentEnrollments,
} from "../../../../../lib/db/training.server";
import { loader } from "../../../../../app/routes/tenant/training/index";

describe("tenant/training/index route", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getTrainingDashboardStats as Mock).mockResolvedValue({
      activeCourses: 5,
      upcomingSessions: 3,
      activeEnrollments: 12,
      certificationsThisMonth: 2,
    });
    (getUpcomingTrainingSessions as Mock).mockResolvedValue([]);
    (getRecentEnrollments as Mock).mockResolvedValue([]);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("calls requireFeature with subscription features", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireFeature).toHaveBeenCalledWith({}, "has_training");
    });

    it("calls requireFeature with actual plan features when subscription exists", async () => {
      const ctxWithSub = {
        ...mockOrgContext,
        subscription: {
          planDetails: {
            features: { has_training: true },
          },
        },
      };
      (requireOrgContext as Mock).mockResolvedValue(ctxWithSub);

      const request = new Request("https://demo.divestreams.com/tenant/training");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireFeature).toHaveBeenCalledWith({ has_training: true }, "has_training");
    });

    it("returns dashboard stats", async () => {
      const mockStats = {
        activeCourses: 10,
        upcomingSessions: 5,
        activeEnrollments: 25,
        certificationsThisMonth: 4,
      };
      (getTrainingDashboardStats as Mock).mockResolvedValue(mockStats);

      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.stats).toEqual(mockStats);
      expect(getTrainingDashboardStats).toHaveBeenCalledWith("org-uuid");
    });

    it("returns upcoming sessions with formatted dates", async () => {
      const mockSessions = [
        {
          id: "session-1",
          courseName: "Open Water Diver",
          startDate: new Date("2026-03-15"),
          startTime: "09:00",
          location: "Beach Site A",
          enrolledCount: 3,
          maxStudents: 6,
          agencyName: "PADI",
        },
        {
          id: "session-2",
          courseName: "Advanced Open Water",
          startDate: "2026-04-01",
          startTime: null,
          location: null,
          enrolledCount: 0,
          maxStudents: 4,
          agencyName: null,
        },
      ];
      (getUpcomingTrainingSessions as Mock).mockResolvedValue(mockSessions);

      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.upcomingSessions).toHaveLength(2);
      expect(result.upcomingSessions[0].startDate).toBe("2026-03-15");
      expect(result.upcomingSessions[1].startDate).toBe("2026-04-01");
      expect(getUpcomingTrainingSessions).toHaveBeenCalledWith("org-uuid", 5);
    });

    it("formats Date objects in sessions to ISO date strings", async () => {
      const mockSessions = [
        {
          id: "session-1",
          courseName: "Rescue Diver",
          startDate: new Date("2026-06-20T10:00:00Z"),
          startTime: "10:00",
          location: "Dock B",
          enrolledCount: 2,
          maxStudents: 4,
          agencyName: "SSI",
        },
      ];
      (getUpcomingTrainingSessions as Mock).mockResolvedValue(mockSessions);

      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.upcomingSessions[0].startDate).toBe("2026-06-20");
    });

    it("returns recent enrollments with formatted dates", async () => {
      const mockEnrollments = [
        {
          id: "enroll-1",
          customerFirstName: "Jane",
          customerLastName: "Doe",
          courseName: "Open Water",
          status: "enrolled",
          enrolledAt: new Date("2026-02-10"),
        },
        {
          id: "enroll-2",
          customerFirstName: "John",
          customerLastName: "Smith",
          courseName: "Advanced",
          status: "in_progress",
          enrolledAt: null,
        },
      ];
      (getRecentEnrollments as Mock).mockResolvedValue(mockEnrollments);

      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.recentEnrollments).toHaveLength(2);
      expect(result.recentEnrollments[0].enrolledAt).toBe("2026-02-10");
      expect(result.recentEnrollments[1].enrolledAt).toBeNull();
      expect(getRecentEnrollments).toHaveBeenCalledWith("org-uuid", 5);
    });

    it("returns orgName from context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.orgName).toBe("Demo Dive Shop");
    });

    it("returns empty arrays when no sessions or enrollments exist", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.upcomingSessions).toEqual([]);
      expect(result.recentEnrollments).toEqual([]);
    });
  });
});
