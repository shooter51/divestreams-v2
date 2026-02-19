import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.confirm";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  getBookingDetails: vi.fn(),
}));

import { getOrganizationBySlug } from "../../../../lib/db/queries.public";
import { getBookingDetails } from "../../../../lib/db/mutations.public";

describe("embed/$tenant.confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when missing bookingId or bookingNumber", async () => {
      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/confirm"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when only bookingId provided", async () => {
      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/confirm?bookingId=b1"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/confirm?bookingId=b1&bookingNumber=BK001"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when booking not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo", name: "Demo Shop" });
      (getBookingDetails as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/confirm?bookingId=b1&bookingNumber=BK001"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns booking details when valid", async () => {
      const mockBooking = {
        bookingNumber: "BK001",
        status: "confirmed",
        trip: { tourName: "Reef Dive", date: "2025-06-01", startTime: "09:00" },
        customer: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      };
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo", name: "Demo Shop" });
      (getBookingDetails as Mock).mockResolvedValue(mockBooking);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/confirm?bookingId=b1&bookingNumber=BK001"),
        params: { tenant: "demo" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.booking).toEqual(mockBooking);
      expect(result.tenantSlug).toBe("demo");
      expect(result.tenantName).toBe("Demo Shop");
      expect(getBookingDetails).toHaveBeenCalledWith("org-1", "b1", "BK001");
    });
  });
});
