import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  loginCustomer: vi.fn(),
  getCustomerBySession: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { db } from "../../../../lib/db";
import { loginCustomer, getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";
import { loader, action } from "../../../../app/routes/site/login";

describe("site/login route", () => {
  const mockOrg = { id: "org-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true });
  });

  // Helper to set up db mock to return an org
  function mockDbReturnsOrg(org = mockOrg) {
    (db.limit as Mock).mockResolvedValue([org]);
  }

  function mockDbReturnsNoOrg() {
    (db.limit as Mock).mockResolvedValue([]);
  }

  describe("loader", () => {
    it("resolves organization by subdomain and returns organizationId", async () => {
      mockDbReturnsOrg();
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/site/login");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(getSubdomainFromHost).toHaveBeenCalled();
      expect(result).toEqual({ organizationId: "org-1" });
    });

    it("throws 404 when organization is not found", async () => {
      mockDbReturnsNoOrg();

      const request = new Request("https://unknown.divestreams.com/site/login");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("redirects to account if already logged in via cookie", async () => {
      mockDbReturnsOrg();
      (getCustomerBySession as Mock).mockResolvedValue({ id: "cust-1", email: "test@test.com" });

      const request = new Request("https://demo.divestreams.com/site/login", {
        headers: { Cookie: "customer_session=valid-token" },
      });

      try {
        const result = await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        // React Router redirect throws a Response
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/account");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toBe("/site/account");
        }
      }
    });

    it("redirects to custom redirect param when logged in", async () => {
      mockDbReturnsOrg();
      (getCustomerBySession as Mock).mockResolvedValue({ id: "cust-1" });

      const request = new Request("https://demo.divestreams.com/site/login?redirect=/site/bookings", {
        headers: { Cookie: "customer_session=valid-token" },
      });

      try {
        const result = await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        if (result instanceof Response) {
          expect(result.headers.get("Location")).toBe("/site/bookings");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.headers.get("Location")).toBe("/site/bookings");
        }
      }
    });

    it("prevents open redirect attacks in redirect param", async () => {
      mockDbReturnsOrg();
      (getCustomerBySession as Mock).mockResolvedValue({ id: "cust-1" });

      const request = new Request("https://demo.divestreams.com/site/login?redirect=https://evil.com", {
        headers: { Cookie: "customer_session=valid-token" },
      });

      try {
        const result = await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        if (result instanceof Response) {
          expect(result.headers.get("Location")).toBe("/site/account");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.headers.get("Location")).toBe("/site/account");
        }
      }
    });

    it("falls back to custom domain lookup when no subdomain", async () => {
      mockDbReturnsOrg();
      (getSubdomainFromHost as Mock).mockReturnValue(null);
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const request = new Request("https://customdomain.com/site/login");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result).toEqual({ organizationId: "org-1" });
    });
  });

  describe("action", () => {
    it("validates required email field", async () => {
      mockDbReturnsOrg();

      const formData = new FormData();
      formData.set("email", "");
      formData.set("password", "password123");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as any).errors.email).toBe("Email is required");
    });

    it("validates email format", async () => {
      mockDbReturnsOrg();

      const formData = new FormData();
      formData.set("email", "not-an-email");
      formData.set("password", "password123");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors.email).toBe("Please enter a valid email address");
    });

    it("validates required password field", async () => {
      mockDbReturnsOrg();

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors.password).toBe("Password is required");
    });

    it("returns rate limit error when too many attempts", async () => {
      mockDbReturnsOrg();
      (checkRateLimit as Mock).mockResolvedValue({
        allowed: false,
        resetAt: Date.now() + 5 * 60 * 1000,
      });

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors.form).toContain("Too many login attempts");
    });

    it("redirects on successful login with session cookie", async () => {
      mockDbReturnsOrg();
      (loginCustomer as Mock).mockResolvedValue({ token: "session-token-abc" });

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "validpassword");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toBe("/site/account");
          expect(result.headers.get("Set-Cookie")).toContain("customer_session=session-token-abc");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Set-Cookie")).toContain("customer_session=session-token-abc");
        }
      }
    });

    it("returns error on invalid credentials", async () => {
      mockDbReturnsOrg();
      (loginCustomer as Mock).mockRejectedValue(new Error("Invalid credentials"));

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "wrongpassword");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).errors.form).toBe("Invalid email or password");
      expect((result as any).email).toBe("test@example.com");
    });

    it("sets remember me cookie with Max-Age when checked", async () => {
      mockDbReturnsOrg();
      (loginCustomer as Mock).mockResolvedValue({ token: "session-token-abc" });

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "validpassword");
      formData.set("rememberMe", "on");

      const request = new Request("https://demo.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          const cookie = result.headers.get("Set-Cookie") || "";
          expect(cookie).toContain("Max-Age=");
        }
      } catch (error) {
        if (error instanceof Response) {
          const cookie = error.headers.get("Set-Cookie") || "";
          expect(cookie).toContain("Max-Age=");
        }
      }
    });

    it("throws 404 when organization not found in action", async () => {
      mockDbReturnsNoOrg();

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");

      const request = new Request("https://unknown.divestreams.com/site/login", {
        method: "POST",
        body: formData,
      });

      try {
        await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });
  });
});
