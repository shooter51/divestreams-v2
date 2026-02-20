import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getSessionById: vi.fn(),
  getEnrollments: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  getCourses: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path, msg, type) => `${path}?notification=${encodeURIComponent(msg)}&type=${type}`),
  useNotification: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } })),
  };
});

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getSessionById,
  getEnrollments,
  updateSession,
  deleteSession,
  getCourses,
} from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/sessions/$id";

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

const mockSession = {
  id: "session-1",
  courseId: "course-1",
  courseName: "Open Water Diver",
  agencyName: "PADI",
  levelName: "Beginner",
  startDate: "2026-03-01",
  endDate: "2026-03-03",
  startTime: "09:00",
  location: "Dive Center",
  meetingPoint: "Front desk",
  instructorName: "John Smith",
  maxStudents: 8,
  enrolledCount: 3,
  completedCount: 0,
  priceOverride: null,
  coursePrice: "350.00",
  courseDurationDays: 3,
  notes: "Bring sunscreen",
  status: "scheduled",
  createdAt: "2026-02-15T10:00:00Z",
  updatedAt: "2026-02-15T10:00:00Z",
};

describe("tenant/training/sessions/$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getSessionById as Mock).mockResolvedValue(mockSession);
    (getEnrollments as Mock).mockResolvedValue([]);
    (getCourses as Mock).mockResolvedValue([]);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1");
      await loader({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 400 when session ID is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown)
      ).rejects.toThrow();

      try {
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      } catch (error) {
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when session is not found", async () => {
      (getSessionById as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/non-existent");

      try {
        await loader({ request, params: { id: "non-existent" }, context: {}, unstable_pattern: "" } as unknown);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns session, enrollments, courses, and isPremium", async () => {
      const mockEnrollments = [
        { id: "enroll-1", customerFirstName: "Jane", customerLastName: "Doe", status: "enrolled" },
      ];
      const mockCourses = [{ id: "course-1", name: "Open Water Diver" }];

      (getEnrollments as Mock).mockResolvedValue(mockEnrollments);
      (getCourses as Mock).mockResolvedValue(mockCourses);

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1");
      const result = await loader({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.session).toEqual(mockSession);
      expect(result.enrollments).toEqual(mockEnrollments);
      expect(result.courses).toEqual(mockCourses);
      expect(result.isPremium).toBe(false);
    });

    it("fetches enrollments filtered by sessionId", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1");
      await loader({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(getEnrollments).toHaveBeenCalledWith("org-uuid", { sessionId: "session-1" });
    });
  });

  describe("action", () => {
    describe("update-status intent", () => {
      it("updates session status", async () => {
        const formData = new FormData();
        formData.append("intent", "update-status");
        formData.append("status", "in_progress");

        const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateSession).toHaveBeenCalledWith("org-uuid", "session-1", { status: "in_progress" });
        expect((result as Response).status).toBe(302);
      });

      it("returns error when status field is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "update-status");

        const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateSession).not.toHaveBeenCalled();
        expect(result).toEqual({ error: "Status is required" });
      });
    });

    describe("update-session intent", () => {
      it("updates session with provided fields", async () => {
        const formData = new FormData();
        formData.append("intent", "update-session");
        formData.append("startDate", "2026-04-01");
        formData.append("endDate", "2026-04-03");
        formData.append("startTime", "10:00");
        formData.append("location", "Beach Site B");
        formData.append("meetingPoint", "Parking lot");
        formData.append("instructorName", "Jane Instructor");
        formData.append("maxStudents", "10");
        formData.append("priceOverride", "400");
        formData.append("notes", "Updated notes");

        const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateSession).toHaveBeenCalledWith("org-uuid", "session-1", {
          startDate: "2026-04-01",
          endDate: "2026-04-03",
          startTime: "10:00",
          location: "Beach Site B",
          meetingPoint: "Parking lot",
          instructorName: "Jane Instructor",
          maxStudents: 10,
          priceOverride: "400",
          notes: "Updated notes",
        });
        expect((result as Response).status).toBe(302);
      });

      it("sets optional fields to null when empty strings are provided", async () => {
        const formData = new FormData();
        formData.append("intent", "update-session");
        formData.append("startDate", "2026-04-01");
        formData.append("endDate", "");
        formData.append("startTime", "");
        formData.append("location", "");
        formData.append("meetingPoint", "");
        formData.append("instructorName", "");
        formData.append("priceOverride", "");
        formData.append("notes", "");

        const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateSession).toHaveBeenCalledWith("org-uuid", "session-1", expect.objectContaining({
          startDate: "2026-04-01",
          endDate: null,
          startTime: null,
          location: null,
          meetingPoint: null,
          instructorName: null,
          priceOverride: null,
          notes: null,
        }));
      });
    });

    describe("delete intent", () => {
      it("deletes the session and redirects to sessions list", async () => {
        const formData = new FormData();
        formData.append("intent", "delete");

        const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(deleteSession).toHaveBeenCalledWith("org-uuid", "session-1");
        expect((result as Response).status).toBe(302);
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-intent");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/session-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "session-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });
  });
});
