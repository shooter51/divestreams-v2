import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../../lib/db/training.server", () => ({
  getCourseById: vi.fn(),
  getSessions: vi.fn(),
  deleteCourse: vi.fn(),
  updateCourse: vi.fn(),
}));

// Mock use-notification
vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(
    (path: string, msg: string, type: string) =>
      `${path}?notification=${encodeURIComponent(msg)}&type=${type}`
  ),
  useNotification: vi.fn(),
}));

// Mock react-router redirect
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(
      (url: string) => new Response(null, { status: 302, headers: { Location: url } })
    ),
  };
});

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCourseById,
  getSessions,
  deleteCourse,
  updateCourse,
} from "../../../../../lib/db/training.server";
import { redirect } from "react-router";
import { loader, action } from "../../../../../app/routes/tenant/training/courses/$id";

describe("tenant/training/courses/$id route", () => {
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

  const mockCourse = {
    id: "course-1",
    name: "Open Water Diver",
    code: "OWD",
    description: "Learn to dive",
    agencyName: "PADI",
    levelName: "Beginner",
    price: "399.00",
    currency: "USD",
    durationDays: 3,
    maxStudents: 6,
    isActive: true,
    isPublic: false,
    images: ["https://example.com/owd.jpg"],
  };

  const mockSessions = [
    {
      id: "session-1",
      startDate: "2026-03-15",
      startTime: "09:00",
      location: "Beach Site A",
      instructorName: "John",
      enrolledCount: 3,
      maxStudents: 6,
      status: "scheduled",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCourseById as Mock).mockResolvedValue(mockCourse);
    (getSessions as Mock).mockResolvedValue(mockSessions);
    (updateCourse as Mock).mockResolvedValue(undefined);
    (deleteCourse as Mock).mockResolvedValue(undefined);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1");
      await loader({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 400 when courseId param is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/");

      try {
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when course is not found", async () => {
      (getCourseById as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {}, unstable_pattern: "" } as unknown);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns course and sessions", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1");
      const result = await loader({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.course).toEqual(mockCourse);
      expect(result.sessions).toEqual(mockSessions);
      expect(getCourseById).toHaveBeenCalledWith("org-uuid", "course-1");
      expect(getSessions).toHaveBeenCalledWith("org-uuid", { courseId: "course-1" });
    });

    it("returns empty sessions array when course has no sessions", async () => {
      (getSessions as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1");
      const result = await loader({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.sessions).toEqual([]);
    });
  });

  describe("action", () => {
    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("toggles isActive from true to false", async () => {
      (getCourseById as Mock).mockResolvedValue({ ...mockCourse, isActive: true });

      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(getCourseById).toHaveBeenCalledWith("org-uuid", "course-1");
      expect(updateCourse).toHaveBeenCalledWith("org-uuid", "course-1", { isActive: false });
      expect(result).toEqual({ toggled: true });
    });

    it("toggles isActive from false to true", async () => {
      (getCourseById as Mock).mockResolvedValue({ ...mockCourse, isActive: false });

      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(updateCourse).toHaveBeenCalledWith("org-uuid", "course-1", { isActive: true });
    });

    it("toggles isPublic from false to true", async () => {
      (getCourseById as Mock).mockResolvedValue({ ...mockCourse, isPublic: false });

      const formData = new FormData();
      formData.append("intent", "toggle-public");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(getCourseById).toHaveBeenCalledWith("org-uuid", "course-1");
      expect(updateCourse).toHaveBeenCalledWith("org-uuid", "course-1", { isPublic: true });
      expect(result).toEqual({ toggled: true });
    });

    it("toggles isPublic from true to false", async () => {
      (getCourseById as Mock).mockResolvedValue({ ...mockCourse, isPublic: true });

      const formData = new FormData();
      formData.append("intent", "toggle-public");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(updateCourse).toHaveBeenCalledWith("org-uuid", "course-1", { isPublic: false });
    });

    it("does not update if course not found on toggle-active", async () => {
      (getCourseById as Mock).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(updateCourse).not.toHaveBeenCalled();
      expect(result).toEqual({ toggled: true });
    });

    it("deletes course and redirects with notification", async () => {
      const formData = new FormData();
      formData.append("intent", "delete");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(deleteCourse).toHaveBeenCalledWith("org-uuid", "course-1");
      expect(redirect).toHaveBeenCalled();
      // The redirect should be a Response with 302 status
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("uses course name in delete notification", async () => {
      (getCourseById as Mock).mockResolvedValue({ ...mockCourse, name: "Rescue Diver" });

      const formData = new FormData();
      formData.append("intent", "delete");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(redirect).toHaveBeenCalledWith(
        expect.stringContaining("Rescue%20Diver")
      );
    });

    it("uses fallback name when course not found on delete", async () => {
      (getCourseById as Mock).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("intent", "delete");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(redirect).toHaveBeenCalledWith(
        expect.stringContaining("Course")
      );
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });
  });
});
