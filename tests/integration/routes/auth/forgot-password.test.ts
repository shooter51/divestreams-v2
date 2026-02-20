import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/auth/forgot-password";

// Mock org-context
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
    },
  },
}));

// Mock database
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

describe("auth/forgot-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after clearAllMocks
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true, remaining: 10 });
  });

  describe("loader", () => {
    it("redirects when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const request = new Request("https://divestreams.com/auth/forgot-password");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("redirects to /tenant when already logged in", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue({ user: { id: "user-1" } });

      const request = new Request("https://demo.divestreams.com/auth/forgot-password");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/tenant");
    });

    it("redirects when organization not found", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("nonexistent");
      (getOrgContext as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://nonexistent.divestreams.com/auth/forgot-password");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("returns tenantName when org exists and not logged in", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([{ name: "Demo Dive Shop", slug: "demo" }]);

      const request = new Request("https://demo.divestreams.com/auth/forgot-password");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toEqual({ tenantName: "Demo Dive Shop" });
    });
  });

  describe("action", () => {
    it("redirects when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const formData = new FormData();
      formData.append("email", "test@example.com");

      const request = new Request("https://divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("returns success when rate limited (prevents enumeration)", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (checkRateLimit as Mock).mockResolvedValue({ allowed: false, remaining: 0 });

      const formData = new FormData();
      formData.append("email", "test@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true });
    });

    it("returns error when email is empty", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("email", "");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Email is required" });
    });

    it("returns success after sending reset email", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.requestPasswordReset as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true });
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: { email: "user@example.com", redirectTo: "https://demo.divestreams.com/auth/reset-password" },
      });
    });

    it("returns success even when auth API throws (prevents enumeration)", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.requestPasswordReset as Mock).mockRejectedValue(new Error("User not found"));

      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true });
    });
  });
});
