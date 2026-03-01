import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/password";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/auth", () => ({
  auth: {
    api: {
      changePassword: vi.fn(),
    },
  },
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  account: { userId: "userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { auth } from "../../../../../lib/auth";

const mockCtx = {
  user: { id: "user-1" },
  org: { id: "org-1" },
};

describe("tenant/settings/password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires org context", async () => {
      (requireOrgContext as Mock).mockRejectedValue(new Response(null, { status: 302 }));

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/settings/password"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("returns forced=false by default", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/tenant/settings/password"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.forced).toBe(false);
      expect(result.message).toBeNull();
    });

    it("returns forced=true when param set", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/tenant/settings/password?forced=true"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.forced).toBe(true);
      expect(result.message).toContain("administrator reset your password");
    });
  });

  describe("action", () => {
    it("returns error when passwords missing", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "All fields are required" });
    });

    it("returns error when passwords don't match", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("currentPassword", "oldpass");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "different");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Passwords do not match" });
    });

    it("returns error when password too short", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("currentPassword", "oldpass");
      formData.append("newPassword", "short");
      formData.append("confirmPassword", "short");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Password must be at least 8 characters" });
    });

    it("returns error when current password missing (non-forced)", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Current password is required" });
    });

    it("changes password successfully (non-forced)", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const response = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toContain("/tenant/dashboard");
    });

    it("changes password successfully (forced)", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const response = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/password?forced=true", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toContain("/tenant/dashboard");
    });
  });
});
