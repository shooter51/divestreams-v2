import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock org-context
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  duplicateTour: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { duplicateTour } from "../../../../../lib/db/queries.server";
import { loader, action } from "../../../../../app/routes/tenant/tours/$id.duplicate";

describe("tenant/tours/$id.duplicate", () => {
  const mockCtx = {
    user: { id: "user-1", email: "owner@test.com" },
    org: { id: "org-1", name: "Test Org" },
    membership: { role: "owner" },
    isPremium: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockCtx);
    (duplicateTour as Mock).mockResolvedValue({ id: "new-tour-id" });
  });

  describe("DS-rpqm: GET must not perform mutations", () => {
    it("rejects GET requests with 405", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/duplicate");

      await expect(
        loader({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as any)
      ).rejects.toMatchObject({ status: 405 });

      // Crucially, duplicateTour must never be called on GET
      expect(duplicateTour).not.toHaveBeenCalled();
    });
  });

  describe("action (POST)", () => {
    it("duplicates tour on POST and redirects", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/duplicate", {
        method: "POST",
        body: new FormData(),
      });

      const result = await action({
        request,
        params: { id: "tour-1" },
        context: {},
        unstable_pattern: "",
      } as any);

      expect(duplicateTour).toHaveBeenCalledWith("org-1", "tour-1");
      // result is a redirect Response
      expect((result as Response).status).toBe(302);
      expect((result as Response).headers.get("Location")).toContain("/tenant/tours/new-tour-id");
    });

    it("rejects non-POST methods with 405", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/duplicate", {
        method: "PUT",
      });

      await expect(
        action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as any)
      ).rejects.toMatchObject({ status: 405 });

      expect(duplicateTour).not.toHaveBeenCalled();
    });

    it("returns 400 when tour ID is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/tours//duplicate", {
        method: "POST",
        body: new FormData(),
      });

      await expect(
        action({ request, params: {}, context: {}, unstable_pattern: "" } as any)
      ).rejects.toMatchObject({ status: 400 });
    });

    it("returns 404 when tour is not found", async () => {
      (duplicateTour as Mock).mockRejectedValue(new Error("Tour not found"));

      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/duplicate", {
        method: "POST",
        body: new FormData(),
      });

      await expect(
        action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as any)
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
