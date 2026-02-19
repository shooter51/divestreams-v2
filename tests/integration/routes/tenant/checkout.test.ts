import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/checkout";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("tenant/checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires org context", async () => {
      (requireOrgContext as Mock).mockRejectedValue(new Response(null, { status: 302, headers: { Location: "/auth/login" } }));

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/checkout"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("redirects to billing with success on successful checkout", async () => {
      (requireOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" }, org: { id: "org-1" } });

      const response = await loader({
        request: new Request("https://demo.divestreams.com/tenant/checkout?success=true"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      const location = (response as Response).headers.get("Location")!;
      expect(location).toContain("/tenant/settings/billing");
      expect(location).toContain("success=true");
    });

    it("redirects to billing with session_id as success", async () => {
      (requireOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" }, org: { id: "org-1" } });

      const response = await loader({
        request: new Request("https://demo.divestreams.com/tenant/checkout?session_id=cs_test_123"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      const location = (response as Response).headers.get("Location")!;
      expect(location).toContain("success=true");
    });

    it("redirects to billing with canceled status", async () => {
      (requireOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" }, org: { id: "org-1" } });

      const response = await loader({
        request: new Request("https://demo.divestreams.com/tenant/checkout?canceled=true"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      const location = (response as Response).headers.get("Location")!;
      expect(location).toContain("canceled=true");
    });

    it("redirects to billing without params when no status", async () => {
      (requireOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" }, org: { id: "org-1" } });

      const response = await loader({
        request: new Request("https://demo.divestreams.com/tenant/checkout"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      const location = (response as Response).headers.get("Location")!;
      expect(location).toContain("/tenant/settings/billing");
    });
  });
});
