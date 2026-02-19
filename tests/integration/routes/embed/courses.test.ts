import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.courses";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourses: vi.fn(),
}));

import { getOrganizationBySlug, getPublicCourses } from "../../../../lib/db/queries.public";

describe("embed/$tenant.courses route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when organization not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({ request: new Request("https://divestreams.com/embed/demo/courses"), params: { tenant: "demo" }, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns courses when organization exists", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo", name: "Demo Shop" });
      const mockCourses = [
        { id: "c1", name: "Open Water", price: "499.00", currency: "USD" },
      ];
      (getPublicCourses as Mock).mockResolvedValue(mockCourses);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/courses"),
        params: { tenant: "demo" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.courses).toEqual(mockCourses);
      expect(getPublicCourses).toHaveBeenCalledWith("org-1");
    });

    it("returns empty courses array when none available", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo", name: "Demo Shop" });
      (getPublicCourses as Mock).mockResolvedValue([]);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/courses"),
        params: { tenant: "demo" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.courses).toEqual([]);
    });
  });
});
