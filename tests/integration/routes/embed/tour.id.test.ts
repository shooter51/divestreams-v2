import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.tour.$id";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTourById: vi.fn(),
}));

import { getOrganizationBySlug, getPublicTourById } from "../../../../lib/db/queries.public";

describe("embed/$tenant.tour.$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when no tour id param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed/demo/tour"), params: { tenant: "demo" }, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/tour/t1"),
          params: { tenant: "demo", id: "t1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when tour not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicTourById as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/tour/t1"),
          params: { tenant: "demo", id: "t1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns tour and tenantSlug when found", async () => {
      const mockTour = { id: "t1", name: "Reef Dive", price: "99.00", currency: "USD", upcomingTrips: [] };
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicTourById as Mock).mockResolvedValue(mockTour);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/tour/t1"),
        params: { tenant: "demo", id: "t1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.tour).toEqual(mockTour);
      expect(result.tenantSlug).toBe("demo");
      expect(getPublicTourById).toHaveBeenCalledWith("org-1", "t1");
    });
  });
});
