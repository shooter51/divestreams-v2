import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/user-profile";

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
  user: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { auth } from "../../../../../lib/auth";

const mockCtx = {
  user: { id: "user-1", name: "Test User", email: "user@example.com" },
  membership: { role: "admin" },
};

describe("tenant/settings/user-profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires org context", async () => {
      (requireOrgContext as Mock).mockRejectedValue(new Response(null, { status: 302 }));

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/settings/user-profile"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("returns user and membership data", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.user.id).toBe("user-1");
      expect(result.user.name).toBe("Test User");
      expect(result.membership.role).toBe("admin");
    });
  });

  describe("action", () => {
    it("updates name successfully", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "update-name");
      formData.append("name", "Updated Name");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, message: "Profile updated successfully", type: "profile" });
    });

    it("returns error for empty name", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "update-name");
      formData.append("name", "  ");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Name is required", field: "name", type: "profile" });
    });

    it("changes password successfully", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, message: "Password changed successfully", type: "password" });
    });

    it("returns error when passwords don't match", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "different");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Passwords do not match", field: "confirmPassword", type: "password" });
    });

    it("returns error when current password incorrect", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockRejectedValue(new Error("Invalid"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "wrong");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Current password is incorrect", field: "currentPassword", type: "password" });
      consoleSpy.mockRestore();
    });

    it("returns null for unknown intent", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "unknown");

      const result = await action({
        request: new Request("https://demo.divestreams.com/tenant/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toBeNull();
    });
  });
});
