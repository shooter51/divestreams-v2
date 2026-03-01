import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/reset-password";

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      resetPassword: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  verification: { identifier: "identifier", value: "value" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

describe("tenant/reset-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("redirects when no token", async () => {
      await expect(
        loader({ request: new Request("https://demo.divestreams.com/reset-password"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("redirects when already logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue({ user: { id: "user-1" } });

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/reset-password?token=abc"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("returns hasToken and email when valid", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([{ identifier: "user@example.com" }]);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/reset-password?token=valid-token"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.hasToken).toBe(true);
      expect(result.email).toBe("user@example.com");
    });

    it("returns empty email when verification not found", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([]);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/reset-password?token=valid-token"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.hasToken).toBe(true);
      expect(result.email).toBe("");
    });
  });

  describe("action", () => {
    it("returns error when token missing", async () => {
      const formData = new FormData();
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/reset-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.form).toContain("Invalid or missing reset token");
    });

    it("returns error when password too short", async () => {
      const formData = new FormData();
      formData.append("token", "abc");
      formData.append("password", "short");
      formData.append("confirmPassword", "short");

      const result = await action({
        request: new Request("https://demo.divestreams.com/reset-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.password).toBe("Password must be at least 8 characters");
    });

    it("returns error when password missing uppercase", async () => {
      const formData = new FormData();
      formData.append("token", "abc");
      formData.append("password", "password1");
      formData.append("confirmPassword", "password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/reset-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.password).toBe("Password must contain at least one uppercase letter");
    });

    it("returns error when passwords don't match", async () => {
      const formData = new FormData();
      formData.append("token", "abc");
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Different1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/reset-password", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.confirmPassword).toBe("Passwords do not match");
    });
  });
});
