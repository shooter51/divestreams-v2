import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getCourseById: vi.fn(),
  getCourses: vi.fn(),
  createSession: vi.fn(),
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
import { getCourseById, getCourses, createSession } from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/sessions/new";

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

const mockCourses = [
  { id: "course-1", name: "Open Water Diver", agencyName: "PADI", price: "350.00", maxStudents: 8 },
  { id: "course-2", name: "Advanced Open Water", agencyName: "PADI", price: "450.00", maxStudents: 6 },
];

const mockSelectedCourse = {
  id: "course-1",
  name: "Open Water Diver",
  agencyName: "PADI",
  price: "350.00",
  maxStudents: 8,
  durationDays: 3,
};

describe("tenant/training/sessions/new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCourses as Mock).mockResolvedValue(mockCourses);
    (getCourseById as Mock).mockResolvedValue(mockSelectedCourse);
    (createSession as Mock).mockResolvedValue({ id: "new-session-1" });
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns courses list", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.courses).toEqual(mockCourses);
      expect(getCourses).toHaveBeenCalledWith("org-uuid");
    });

    it("returns selectedCourse as null when no courseId provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.selectedCourse).toBeNull();
      expect(result.courseId).toBeNull();
      expect(getCourseById).not.toHaveBeenCalled();
    });

    it("returns selectedCourse when courseId query param is provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new?courseId=course-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.selectedCourse).toEqual(mockSelectedCourse);
      expect(result.courseId).toBe("course-1");
      expect(getCourseById).toHaveBeenCalledWith("org-uuid", "course-1");
    });
  });

  describe("action", () => {
    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("startDate", "2026-04-01");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("validates courseId is required", async () => {
      const formData = new FormData();
      formData.append("startDate", "2026-04-01");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toEqual({ errors: { courseId: "Please select a course" } });
      expect(createSession).not.toHaveBeenCalled();
    });

    it("validates startDate is required", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toEqual({ errors: { startDate: "Start date is required" } });
      expect(createSession).not.toHaveBeenCalled();
    });

    it("returns both errors when both fields are missing", async () => {
      const formData = new FormData();

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toEqual({
        errors: {
          courseId: "Please select a course",
          startDate: "Start date is required",
        },
      });
    });

    it("creates session with all form fields", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("startDate", "2026-04-01");
      formData.append("endDate", "2026-04-03");
      formData.append("startTime", "09:00");
      formData.append("location", "Dive Center");
      formData.append("meetingPoint", "Front desk");
      formData.append("instructorName", "John Smith");
      formData.append("maxStudents", "8");
      formData.append("priceOverride", "400");
      formData.append("notes", "Bring sunscreen");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createSession).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        courseId: "course-1",
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        startTime: "09:00",
        location: "Dive Center",
        meetingPoint: "Front desk",
        instructorName: "John Smith",
        maxStudents: 8,
        priceOverride: "400",
        notes: "Bring sunscreen",
        status: "scheduled",
      });
      expect((result as Response).status).toBe(302);
    });

    it("creates session with only required fields and sets optional fields to undefined", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("startDate", "2026-04-01");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createSession).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        courseId: "course-1",
        startDate: "2026-04-01",
        endDate: undefined,
        startTime: undefined,
        location: undefined,
        meetingPoint: undefined,
        instructorName: undefined,
        maxStudents: undefined,
        priceOverride: undefined,
        notes: undefined,
        status: "scheduled",
      });
    });

    it("redirects to sessions list on success", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("startDate", "2026-04-01");

      const request = new Request("https://demo.divestreams.com/tenant/training/sessions/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect((result as Response).status).toBe(302);
    });
  });
});
