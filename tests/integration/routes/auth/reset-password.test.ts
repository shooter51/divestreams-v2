import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/auth/reset-password";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      resetPassword: vi.fn(),
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
  organization: { slug: "slug", name: "name", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("http://localhost:5173"),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { getSubdomainFromRequest, getOrgContext } from "../../../../lib/auth/org-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";

describe("auth/reset-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after clearAllMocks
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true, remaining: 10 });
    (db.select as Mock).mockReturnThis();
    (db.from as Mock).mockReturnThis();
    (db.where as Mock).mockReturnThis();
    (db.limit as Mock).mockResolvedValue([{ name: "Demo Dive Shop", slug: "demo" }]);
  });

  describe("loader", () => {
    it("returns token and default tenantName when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const request = new Request("https://divestreams.com/auth/reset-password?token=abc");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toEqual({ token: "abc", tenantName: "DiveStreams" });
    });

    it("redirects to /tenant when already logged in", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" } });

      const request = new Request("https://demo.divestreams.com/auth/reset-password?token=abc");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/tenant");
    });

    it("redirects to forgot-password when no token", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/auth/reset-password");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/auth/forgot-password");
    });

    it("returns token and tenantName when valid", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([{ name: "Demo Dive Shop", slug: "demo" }]);

      const request = new Request("https://demo.divestreams.com/auth/reset-password?token=valid-token");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toEqual({ token: "valid-token", tenantName: "Demo Dive Shop" });
    });
  });

  describe("action", () => {
    it("returns error when no password provided without subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const formData = new FormData();
      formData.append("token", "abc");
      const request = new Request("https://divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Password must be at least 8 characters" });
    });

    it("returns error when rate limited", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (checkRateLimit as Mock).mockResolvedValue({ allowed: false });

      const formData = new FormData();
      formData.append("password", "newpassword");
      formData.append("confirmPassword", "newpassword");
      formData.append("token", "abc");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Too many attempts. Please try again later." });
    });

    it("returns error when password too short", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("password", "short");
      formData.append("confirmPassword", "short");
      formData.append("token", "abc");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Password must be at least 8 characters" });
    });

    it("returns error when passwords don't match", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("password", "newpassword123");
      formData.append("confirmPassword", "differentpassword");
      formData.append("token", "abc");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Passwords do not match" });
    });

    it("returns error when token missing", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("password", "newpassword123");
      formData.append("confirmPassword", "newpassword123");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Invalid reset token" });
    });

    it("redirects to login on successful reset", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.resetPassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("password", "newpassword123");
      formData.append("confirmPassword", "newpassword123");
      formData.append("token", "valid-token");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toContain("/auth/login");
    });

    it("returns error when reset fails", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.resetPassword as Mock).mockRejectedValue(new Error("Invalid token"));

      const formData = new FormData();
      formData.append("password", "newpassword123");
      formData.append("confirmPassword", "newpassword123");
      formData.append("token", "expired-token");

      const request = new Request("https://demo.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Invalid or expired reset token" });
    });
  });
});
