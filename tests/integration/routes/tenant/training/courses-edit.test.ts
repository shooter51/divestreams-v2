import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock paths: test file is 5 levels deep (tests/integration/routes/tenant/training/)
// Source file imports from 6 levels deep (app/routes/tenant/training/courses/$id/edit.tsx)
// But mocks resolve relative to the SOURCE file, so we use the source's import paths

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getCourseById: vi.fn(),
  getAgencies: vi.fn(),
  getLevels: vi.fn(),
  updateCourse: vi.fn(),
}));

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(() => ({
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    },
    schema: {
      images: {
        id: "id",
        url: "url",
        thumbnailUrl: "thumbnailUrl",
        filename: "filename",
        width: "width",
        height: "height",
        alt: "alt",
        sortOrder: "sortOrder",
        isPrimary: "isPrimary",
        entityType: "entityType",
        entityId: "entityId",
      },
    },
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  asc: vi.fn((field) => ({ type: "asc", field })),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path, msg, type) => `${path}?${type}=${encodeURIComponent(msg)}`),
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
import { getCourseById, getAgencies, getLevels, updateCourse } from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/courses/$id/edit";

describe("tenant/training/courses/$id/edit route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
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
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const mockCourse = { id: "course-1", name: "Open Water Diver" };
      (getCourseById as Mock).mockResolvedValue(mockCourse);
      (getAgencies as Mock).mockResolvedValue([]);
      (getLevels as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit");
      await loader({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 400 when courseId is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses//edit");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("throws 404 when course is not found", async () => {
      (getCourseById as Mock).mockResolvedValue(null);
      (getAgencies as Mock).mockResolvedValue([]);
      (getLevels as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/nonexistent/edit");

      await expect(
        loader({ request, params: { id: "nonexistent" }, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("returns course, agencies, levels, and images", async () => {
      const mockCourse = {
        id: "course-1",
        name: "Open Water Diver",
        agencyId: "agency-1",
        price: "350.00",
      };
      const mockAgencies = [{ id: "agency-1", name: "PADI", code: "padi" }];
      const mockLevels = [{ id: "level-1", name: "Beginner" }];

      (getCourseById as Mock).mockResolvedValue(mockCourse);
      (getAgencies as Mock).mockResolvedValue(mockAgencies);
      (getLevels as Mock).mockResolvedValue(mockLevels);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit");
      const result = await loader({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(result.course).toEqual(mockCourse);
      expect(result.agencies).toEqual(mockAgencies);
      expect(result.levels).toEqual(mockLevels);
      expect(result.images).toBeDefined();
    });
  });

  describe("action", () => {
    it("throws 400 when courseId is missing", async () => {
      const formData = new FormData();
      formData.append("name", "Test Course");
      formData.append("price", "100");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses//edit", {
        method: "POST",
        body: formData,
      });

      await expect(
        action({ request, params: {}, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("returns validation error when name is empty", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("price", "100");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(result.errors).toBeDefined();
      expect(result.errors.name).toBeDefined();
    });

    it("returns validation error when price is invalid", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("price", "not-a-number");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(result.errors).toBeDefined();
      expect(result.errors.price).toBeDefined();
    });

    it("returns validation error when price is negative", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("price", "-50");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(result.errors).toBeDefined();
      expect(result.errors.price).toBeDefined();
    });

    it("updates course and redirects on valid input", async () => {
      (updateCourse as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("code", "OWD");
      formData.append("description", "Entry level certification");
      formData.append("price", "350.00");
      formData.append("currency", "USD");
      formData.append("durationDays", "4");
      formData.append("isActive", "true");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as any);

      expect(updateCourse).toHaveBeenCalledWith("org-uuid", "course-1", expect.objectContaining({
        name: "Open Water Diver",
        code: "OWD",
        price: "350.00",
      }));
      // Result should be a redirect Response
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
    });
  });
});
