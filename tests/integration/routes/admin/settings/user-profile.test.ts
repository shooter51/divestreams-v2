import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/admin/settings/user-profile";

vi.mock("../../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
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

import { requirePlatformContext } from "../../../../../lib/auth/platform-context.server";
import { auth } from "../../../../../lib/auth";

const mockCtx = {
  user: { id: "user-1", name: "Admin User", email: "admin@divestreams.com" },
  membership: { role: "owner" },
  isOwner: true,
};

describe("admin/settings/user-profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires platform context", async () => {
      (requirePlatformContext as Mock).mockRejectedValue(new Response(null, { status: 401 }));

      await expect(
        loader({ request: new Request("https://admin.divestreams.com/settings/user-profile"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 401 }));
    });

    it("returns user and membership data", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/settings/user-profile"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.user.id).toBe("user-1");
      expect(result.user.name).toBe("Admin User");
      expect(result.membership.role).toBe("owner");
      expect(result.isOwner).toBe(true);
    });
  });

  describe("action", () => {
    it("updates name successfully", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "update-name");
      formData.append("name", "New Name");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, message: "Profile updated successfully", type: "profile" });
    });

    it("returns error when name is empty", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "update-name");
      formData.append("name", "");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Name is required", field: "name", type: "profile" });
    });

    it("changes password successfully", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, message: "Password changed successfully", type: "password" });
    });

    it("returns error when current password missing", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Current password is required", field: "currentPassword", type: "password" });
    });

    it("returns error when new password too short", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "short");
      formData.append("confirmPassword", "short");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Password must be at least 8 characters", field: "newPassword", type: "password" });
    });

    it("returns error when passwords don't match", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpassword1");
      formData.append("confirmPassword", "different123");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Passwords do not match", field: "confirmPassword", type: "password" });
    });

    it("returns error when current password is incorrect", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockCtx);
      (auth.api.changePassword as Mock).mockRejectedValue(new Error("Invalid password"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "wrongpass");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");

      const result = await action({
        request: new Request("https://admin.divestreams.com/settings/user-profile", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Current password is incorrect", field: "currentPassword", type: "password" });
      consoleSpy.mockRestore();
    });
  });
});
