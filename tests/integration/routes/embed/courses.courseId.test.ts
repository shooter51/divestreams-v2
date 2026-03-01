import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.courses.$courseId";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourseById: vi.fn(),
}));

import { getOrganizationBySlug, getPublicCourseById } from "../../../../lib/db/queries.public";

describe("embed/$tenant.courses.$courseId route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when no courseId param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed/demo/courses"), params: { tenant: "demo" }, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when organization not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/c1"),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when course not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicCourseById as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/c1"),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns course and tenantSlug when found", async () => {
      const mockCourse = { id: "c1", name: "Open Water", upcomingSessions: [] };
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/courses/c1"),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.course).toEqual(mockCourse);
      expect(result.tenantSlug).toBe("demo");
      expect(getPublicCourseById).toHaveBeenCalledWith("org-1", "c1");
    });
  });
});
