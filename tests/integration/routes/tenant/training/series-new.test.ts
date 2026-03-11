import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getCourses: vi.fn(),
  createSeries: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(
    (path, msg, type) => `${path}?notification=${encodeURIComponent(msg)}&type=${type}`
  ),
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
import { getCourses, createSeries } from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/series/new";

const mockOrgContext = {
  user: { id: "user-1", name: "Test User", email: "test@example.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  subscription: null,
  limits: {},
  usage: {},
  canAddCustomer: true,
  canAddTour: true,
  canAddBooking: true,
  isPremium: false,
};

const mockCourses = [
  { id: "course-1", name: "Open Water Diver", agencyName: "PADI", price: "350.00", maxStudents: 8 },
  { id: "course-2", name: "Advanced Open Water", agencyName: "PADI", price: "450.00", maxStudents: 6 },
];

describe("tenant/training/series/new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCourses as Mock).mockResolvedValue(mockCourses);
    (createSeries as Mock).mockResolvedValue({ id: "series-1" });
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/new");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns courses list", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.courses).toEqual(mockCourses);
      expect(getCourses).toHaveBeenCalledWith("org-uuid");
    });

    it("returns only courses when no courseId query param provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/new?courseId=course-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.courses).toEqual(mockCourses);
    });

    it("returns courses list regardless of query params", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.courses).toEqual(mockCourses);
    });
  });

  describe("action", () => {
    it("validates courseId is required", async () => {
      const formData = new FormData();
      formData.append("name", "Spring 2026 Series");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result).toEqual({ errors: { courseId: "Please select a course" } });
      expect(createSeries).not.toHaveBeenCalled();
    });

    it("validates name is required", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result).toEqual({ errors: { name: "Series name is required" } });
      expect(createSeries).not.toHaveBeenCalled();
    });

    it("creates series with required fields", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("name", "Spring 2026 OW Series");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createSeries).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        courseId: "course-1",
        name: "Spring 2026 OW Series",
        maxStudents: undefined,
        priceOverride: undefined,
        instructorName: undefined,
        notes: undefined,
        status: "scheduled",
        sessions: [],
      });
      expect((result as Response).status).toBe(302);
    });

    it("creates series with all optional fields", async () => {
      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("name", "Spring 2026 OW Series");
      formData.append("maxStudents", "6");
      formData.append("priceOverride", "325.00");
      formData.append("instructorId", "user-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createSeries).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        courseId: "course-1",
        name: "Spring 2026 OW Series",
        maxStudents: 6,
        priceOverride: "325.00",
        instructorName: undefined,
        notes: undefined,
        status: "scheduled",
        sessions: [],
      });
      expect((result as Response).status).toBe(302);
    });

    it("redirects to series detail page on success", async () => {
      (createSeries as Mock).mockResolvedValue({ id: "series-1" });

      const formData = new FormData();
      formData.append("courseId", "course-1");
      formData.append("name", "Spring 2026 OW Series");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect((result as Response).status).toBe(302);
      const location = (result as Response).headers.get("Location");
      expect(location).toContain("/tenant/training/series");
    });
  });
});
