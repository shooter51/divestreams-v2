import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock react-router redirect - must be before importing route
const mockRedirect = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string, init?: ResponseInit) => {
      mockRedirect(url, init);
      const headers = new Headers(init?.headers);
      headers.set("location", url);
      const response = new Response(null, {
        status: 302,
        headers,
      });
      // Return response (React Router v7 actions use return redirect(), not throw)
      return response;
    },
  };
});

// Mock dependencies before importing the route
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
  },
  member: {
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
  },
  user: {
    id: "id",
    email: "email",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "https://divestreams.com"),
  getTenantUrl: vi.fn((slug: string, path: string) => `https://${slug}.divestreams.com${path}`),
}));

// Mock rate limiting - always allow in tests
vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 900000 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// Mock CSRF module
vi.mock("../../../../lib/security/csrf.server", () => ({
  generateAnonCsrfToken: vi.fn().mockReturnValue("test-csrf-token"),
  validateAnonCsrfToken: vi.fn().mockReturnValue(true),
  CSRF_FIELD_NAME: "_csrf",
}));

import { loader, action } from "../../../../app/routes/auth/login";
import { getSubdomainFromRequest, getOrgContext } from "../../../../lib/auth/org-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

describe("auth/login route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    (db.select as Mock).mockReturnThis();
    (db.from as Mock).mockReturnThis();
    (db.where as Mock).mockReturnThis();
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (getOrgContext as Mock).mockResolvedValue(null); // Default: no org context
    (auth.api.getSession as Mock).mockResolvedValue(null); // Default: no session
  });

  describe("loader", () => {
    it("returns discovery mode when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const request = new Request("https://divestreams.com/auth/login");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toMatchObject({ mode: "discovery", csrfToken: "test-csrf-token" });
    });

    it("redirects to /tenant when already logged in", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue({
        user: { id: "user-1" },
        org: mockOrg,
      });

      const request = new Request("https://demo.divestreams.com/auth/login");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("location")).toBe("/tenant");
    });

    it("redirects when organization not found", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("nonexistent");
      (getOrgContext as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://nonexistent.divestreams.com/auth/login");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("returns tenant name when valid organization", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue(null);
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const request = new Request("https://demo.divestreams.com/auth/login");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result).toEqual({
        mode: "tenant",
        tenantName: "Demo Dive Shop",
        mainSiteUrl: "https://divestreams.com",
        noAccessError: null,
        csrfToken: "test-csrf-token"
      });
    });
  });

  describe("action", () => {
    it("redirects to tenant login when user found via discovery", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);
      const mockUser = { id: "user-1" };
      const mockMembership = { organizationId: "org-1" };
      const mockOrgWithSlug = { slug: "demo" };
      // Chain: user lookup → membership lookup → org lookup
      (db.limit as Mock)
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([mockMembership])
        .mockResolvedValueOnce([mockOrgWithSlug]);

      const formData = new FormData();
      formData.append("email", "test@example.com");

      const request = new Request("https://divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("location")).toBe("https://demo.divestreams.com/auth/login");
    });

    it("returns error when email not found in discovery mode", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);
      (db.limit as Mock).mockResolvedValueOnce([]); // no user found

      const formData = new FormData();
      formData.append("email", "notfound@example.com");

      const request = new Request("https://divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toMatchObject({ mode: "discovery", errors: { email: expect.stringContaining("No account") } });
    });

    it("returns error when email is missing", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.append("password", "password123");

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.email).toBe("Email is required");
    });

    it("returns error when password is missing", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.append("email", "test@example.com");

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.password).toBe("Password is required");
    });

    it("returns errors when both email and password missing", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.email).toBe("Email is required");
      expect(errors.password).toBe("Password is required");
    });

    it("returns error on invalid credentials", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);
      (auth.api.signInEmail as Mock).mockResolvedValue({
        ok: false,
        headers: new Headers(),
        json: async () => ({ message: "Invalid credentials" }),
      });

      const formData = new FormData();
      formData.append("email", "test@example.com");
      formData.append("password", "wrongpassword");

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.form).toBe("Invalid credentials");
    });

    it("redirects to /tenant on successful login", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      // Mock auth response as a proper Response-like object
      const mockAuthResponse = {
        ok: true,
        headers: new Headers([["set-cookie", "session=abc123"]]),
        json: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } }),
      };
      (auth.api.signInEmail as Mock).mockResolvedValue(mockAuthResponse);

      const formData = new FormData();
      formData.append("email", "test@example.com");
      formData.append("password", "correctpassword");

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("location")).toBe("/tenant");
    });

    it("redirects to custom redirect URL on success", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      // Mock auth response as a proper Response-like object
      const mockAuthResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      };
      (auth.api.signInEmail as Mock).mockResolvedValue(mockAuthResponse);

      const formData = new FormData();
      formData.append("email", "test@example.com");
      formData.append("password", "correctpassword");

      const request = new Request("https://demo.divestreams.com/auth/login?redirect=/tenant/bookings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("location")).toBe("/tenant/bookings");
    });

    it("handles auth error gracefully", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);
      (auth.api.signInEmail as Mock).mockRejectedValue(new Error("Auth service unavailable"));

      const formData = new FormData();
      formData.append("email", "test@example.com");
      formData.append("password", "password123");

      const request = new Request("https://demo.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.form).toBe("Invalid email or password");
    });
  });
});
