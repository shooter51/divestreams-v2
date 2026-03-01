import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/forgot-password";

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

import { auth } from "../../../../lib/auth";

describe("tenant/forgot-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("redirects when already logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue({ user: { id: "user-1" } });

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/forgot-password"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("returns empty object when not logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/forgot-password"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result).toEqual({});
    });
  });

  describe("action", () => {
    it("returns error for invalid email", async () => {
      const formData = new FormData();
      formData.append("email", "invalid");

      const result = await action({
        request: new Request("https://demo.divestreams.com/forgot-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Please enter a valid email address" });
    });

    it("returns error for empty email", async () => {
      const formData = new FormData();
      formData.append("email", "");

      const result = await action({
        request: new Request("https://demo.divestreams.com/forgot-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Please enter a valid email address" });
    });

    it("returns success after requesting reset", async () => {
      (auth.api.requestPasswordReset as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const result = await action({
        request: new Request("https://demo.divestreams.com/forgot-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, email: "user@example.com" });
    });

    it("returns success even when auth API throws (prevents enumeration)", async () => {
      (auth.api.requestPasswordReset as Mock).mockRejectedValue(new Error("User not found"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");

      const result = await action({
        request: new Request("https://demo.divestreams.com/forgot-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true, email: "nonexistent@example.com" });
      consoleSpy.mockRestore();
    });
  });
});
