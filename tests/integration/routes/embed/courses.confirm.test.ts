import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.courses.confirm";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  getEnrollmentDetails: vi.fn(),
}));

import { getOrganizationBySlug } from "../../../../lib/db/queries.public";
import { getEnrollmentDetails } from "../../../../lib/db/mutations.public";

describe("embed/$tenant.courses.confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/confirm?enrollmentId=e1"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 400 when no enrollmentId", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/confirm"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });

    it("throws 404 when enrollment not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getEnrollmentDetails as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/confirm?enrollmentId=nonexistent"),
          params: { tenant: "demo" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns enrollment and tenantSlug when valid", async () => {
      const mockEnrollment = {
        id: "e1",
        status: "enrolled",
        course: { name: "Open Water" },
        session: { startDate: "2025-06-01" },
        customer: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      };
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getEnrollmentDetails as Mock).mockResolvedValue(mockEnrollment);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/courses/confirm?enrollmentId=e1"),
        params: { tenant: "demo" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.enrollment).toEqual(mockEnrollment);
      expect(result.tenantSlug).toBe("demo");
      expect(getEnrollmentDetails).toHaveBeenCalledWith("org-1", "e1");
    });
  });
});
