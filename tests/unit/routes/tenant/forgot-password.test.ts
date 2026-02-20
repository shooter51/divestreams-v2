import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Unit Tests for Tenant Forgot Password Route (KAN-664)
 *
 * Tests the tenant forgot-password loader/action and the
 * auth forgot-password loader/action, plus reset-password action validation.
 */

// Mock react-router redirect
let shouldThrowRedirect = false;
const mockRedirect = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string, init?: ResponseInit) => {
      mockRedirect(url, init);
      const response = new Response(null, {
        status: 302,
        headers: {
          Location: url,
          ...(init?.headers || {}),
        },
      });
      if (shouldThrowRedirect) {
        throw response;
      }
      return response;
    },
  };
});

// Mock auth module
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

// Mock org-context
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
  },
  verification: {
    identifier: "identifier",
    value: "value",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "https://divestreams.com"),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest, getOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";

// Import tenant forgot-password route
import {
  loader as tenantForgotLoader,
  action as tenantForgotAction,
} from "../../../../app/routes/tenant/forgot-password";

// Import tenant reset-password route
import {
  loader as tenantResetLoader,
  action as tenantResetAction,
} from "../../../../app/routes/tenant/reset-password";

// Import auth forgot-password route
import {
  loader as authForgotLoader,
  action as authForgotAction,
} from "../../../../app/routes/auth/forgot-password";

const makeArgs = (request: Request) =>
  ({ request, params: {}, context: {}, unstable_pattern: "" }) as unknown;

describe("Tenant Forgot Password Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    shouldThrowRedirect = false;
  });

  describe("loader", () => {
    it("returns empty object when user is not logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password");
      const result = await tenantForgotLoader(makeArgs(request));

      expect(result).toEqual({});
    });

    it("redirects to /tenant when already logged in", async () => {
      shouldThrowRedirect = true;
      (auth.api.getSession as Mock).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
      });

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password");

      try {
        await tenantForgotLoader(makeArgs(request));
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe("/tenant");
      }
    });
  });

  describe("action", () => {
    it("returns error when email is empty/invalid", async () => {
      const formData = new FormData();
      formData.append("email", "");

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantForgotAction(makeArgs(request));
      expect(result).toHaveProperty("error");
      expect((result as unknown).error).toContain("valid email");
    });

    it("returns error when email format is invalid", async () => {
      const formData = new FormData();
      formData.append("email", "not-an-email");

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantForgotAction(makeArgs(request));
      expect(result).toHaveProperty("error");
      expect((result as unknown).error).toContain("valid email");
    });

    it("returns success for valid email (calls requestPasswordReset)", async () => {
      (auth.api.requestPasswordReset as Mock).mockResolvedValue({});
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantForgotAction(makeArgs(request));
      expect((result as unknown).success).toBe(true);
      expect((result as unknown).email).toBe("user@example.com");
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ email: "user@example.com" }),
        })
      );
    });

    it("returns success even when requestPasswordReset throws (email enumeration protection)", async () => {
      (auth.api.requestPasswordReset as Mock).mockRejectedValue(new Error("User not found"));
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantForgotAction(makeArgs(request));
      // Should still return success to prevent email enumeration
      expect((result as unknown).success).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});

describe("Tenant Reset Password Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    shouldThrowRedirect = false;
  });

  describe("loader", () => {
    it("redirects to /forgot-password when no token provided", async () => {
      shouldThrowRedirect = true;

      const request = new Request("https://demo.divestreams.com/tenant/reset-password");

      try {
        await tenantResetLoader(makeArgs(request));
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe("/forgot-password");
      }
    });

    it("returns hasToken when valid token provided", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      // Mock verification lookup
      (db.limit as Mock).mockResolvedValue([{ identifier: "user@example.com" }]);

      const request = new Request("https://demo.divestreams.com/tenant/reset-password?token=valid-token");
      const result = await tenantResetLoader(makeArgs(request));

      expect((result as unknown).hasToken).toBe(true);
      expect((result as unknown).email).toBe("user@example.com");
    });

    it("redirects when already logged in with token", async () => {
      shouldThrowRedirect = true;
      (auth.api.getSession as Mock).mockResolvedValue({
        user: { id: "user-1" },
      });

      const request = new Request("https://demo.divestreams.com/tenant/reset-password?token=valid-token");

      try {
        await tenantResetLoader(makeArgs(request));
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe("/tenant");
      }
    });
  });

  describe("action", () => {
    it("returns error when token is missing", async () => {
      const formData = new FormData();
      formData.append("password", "NewPass123");
      formData.append("confirmPassword", "NewPass123");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.form).toContain("Invalid or missing reset token");
    });

    it("returns error when password is too short", async () => {
      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "short");
      formData.append("confirmPassword", "short");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.password).toContain("at least 8 characters");
    });

    it("returns error when password has no uppercase", async () => {
      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "lowercase1");
      formData.append("confirmPassword", "lowercase1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.password).toContain("uppercase");
    });

    it("returns error when password has no lowercase", async () => {
      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "UPPERCASE1");
      formData.append("confirmPassword", "UPPERCASE1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.password).toContain("lowercase");
    });

    it("returns error when password has no number", async () => {
      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "NoNumberHere");
      formData.append("confirmPassword", "NoNumberHere");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.password).toContain("number");
    });

    it("returns error when passwords do not match", async () => {
      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "ValidPass1");
      formData.append("confirmPassword", "DifferentPass1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.confirmPassword).toContain("do not match");
    });

    it("returns success when password reset succeeds (no auto-login)", async () => {
      (auth.api.resetPassword as Mock).mockResolvedValue(
        new Response(JSON.stringify({ status: true }), { status: 200 })
      );

      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "NewValidPass1");
      formData.append("confirmPassword", "NewValidPass1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).success).toBe(true);
    });

    it("returns error when reset API fails", async () => {
      (auth.api.resetPassword as Mock).mockResolvedValue(
        new Response(JSON.stringify({ message: "Token expired" }), { status: 400 })
      );

      const formData = new FormData();
      formData.append("token", "expired-token");
      formData.append("password", "NewValidPass1");
      formData.append("confirmPassword", "NewValidPass1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.form).toBeDefined();
    });

    it("handles unexpected errors gracefully", async () => {
      (auth.api.resetPassword as Mock).mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("token", "valid-token");
      formData.append("password", "NewValidPass1");
      formData.append("confirmPassword", "NewValidPass1");

      const request = new Request("https://demo.divestreams.com/tenant/reset-password", {
        method: "POST",
        body: formData,
      });

      const result = await tenantResetAction(makeArgs(request));
      expect((result as unknown).errors?.form).toContain("error occurred");

      consoleSpy.mockRestore();
    });
  });
});

describe("Auth Forgot Password Route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    shouldThrowRedirect = false;
    (db.select as Mock).mockReturnThis();
    (db.from as Mock).mockReturnThis();
    (db.where as Mock).mockReturnThis();
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (getOrgContext as Mock).mockResolvedValue(null);
  });

  describe("loader", () => {
    it("redirects when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const request = new Request("https://divestreams.com/auth/forgot-password");
      const response = await authForgotLoader(makeArgs(request));

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("redirects when already logged in", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (getOrgContext as Mock).mockResolvedValue({
        user: { id: "user-1" },
        org: mockOrg,
      });

      const request = new Request("https://demo.divestreams.com/auth/forgot-password");
      const response = await authForgotLoader(makeArgs(request));

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("redirects when organization not found", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("nonexistent");
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://nonexistent.divestreams.com/auth/forgot-password");
      const response = await authForgotLoader(makeArgs(request));

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("returns tenant name when valid organization", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const request = new Request("https://demo.divestreams.com/auth/forgot-password");
      const result = await authForgotLoader(makeArgs(request));

      expect((result as unknown).tenantName).toBe("Demo Dive Shop");
    });
  });

  describe("action", () => {
    it("redirects when no subdomain", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue(null);

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const request = new Request("https://divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      const response = await authForgotAction(makeArgs(request));
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
    });

    it("returns error when email is empty", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const formData = new FormData();
      formData.append("email", "");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await authForgotAction(makeArgs(request));
      expect((result as unknown).error).toBe("Email is required");
    });

    it("returns success for valid email", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.requestPasswordReset as Mock).mockResolvedValue({});

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await authForgotAction(makeArgs(request));
      expect((result as unknown).success).toBe(true);
    });

    it("returns success even when API throws (email enumeration protection)", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (auth.api.requestPasswordReset as Mock).mockRejectedValue(new Error("Not found"));

      const formData = new FormData();
      formData.append("email", "unknown@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await authForgotAction(makeArgs(request));
      // Always shows success to prevent email enumeration
      expect((result as unknown).success).toBe(true);
    });

    it("returns success when rate limited (does not reveal rate limiting)", async () => {
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (checkRateLimit as Mock).mockReturnValue({ allowed: false });

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const request = new Request("https://demo.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      const result = await authForgotAction(makeArgs(request));
      // Rate limiting is hidden - shows success to prevent enumeration
      expect((result as unknown).success).toBe(true);
    });
  });
});

describe("Site Login - Forgot Password Link", () => {
  it("site login page should link to /auth/forgot-password (not /site/forgot-password)", async () => {
    // This is a static code verification test
    // We read the actual source to confirm the link target
    const fs = await import("fs");
    const path = await import("path");
    const loginSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../app/routes/site/login.tsx"),
      "utf-8"
    );

    // The forgot password link should point to /auth/forgot-password
    expect(loginSource).toContain('to="/auth/forgot-password"');
    // It should NOT point to /site/forgot-password (the old broken link)
    expect(loginSource).not.toContain('to="/site/forgot-password"');
  });
});
