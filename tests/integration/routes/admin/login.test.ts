import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/login";

// Mock isAdminSubdomain
vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

// Mock getPlatformContext
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  getPlatformContext: vi.fn(),
  PLATFORM_ORG_SLUG: "platform",
}));

// Mock Better Auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
    },
  },
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

// Mock getAppUrl
vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("http://localhost:5173"),
}));

// Mock rate limiting - always allow
vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
  },
  member: {
    userId: "userId",
    organizationId: "organizationId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}));

import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";
import { getPlatformContext } from "../../../../lib/auth/platform-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

// Type for auth.api.signInEmail mock
const signInEmailMock = auth.api.signInEmail as Mock;

describe("admin/login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("redirects to main site when not on admin subdomain", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(false);

      const request = new Request("https://demo.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      // Uses getAppUrl() which returns APP_URL env var or default
      expect((response as Response).headers.get("Location")).toBe("http://localhost:5173");
    });

    it("redirects to dashboard when already authenticated as platform admin", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (getPlatformContext as Mock).mockResolvedValue({
        user: { id: "user-1", email: "admin@example.com" },
        session: { id: "session-1" },
        membership: { role: "owner" },
        isOwner: true,
        isAdmin: true,
      });

      const request = new Request("https://admin.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(getPlatformContext).toHaveBeenCalledWith(request);
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/dashboard");
    });

    it("returns null when on admin subdomain and not authenticated", async () => {
      (isAdminSubdomain as Mock).mockReturnValue(true);
      (getPlatformContext as Mock).mockResolvedValue(null);

      const request = new Request("https://admin.divestreams.com/login");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(getPlatformContext).toHaveBeenCalledWith(request);
      expect(response).toBeNull();
    });
  });

  describe("action", () => {
    it("returns error when email is empty", async () => {
      const formData = new FormData();
      formData.append("email", "");
      formData.append("password", "password123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "Please enter a valid email address", email: "" });
    });

    it("returns error when email is invalid format", async () => {
      const formData = new FormData();
      formData.append("email", "notanemail");
      formData.append("password", "password123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "Please enter a valid email address", email: "notanemail" });
    });

    it("returns error when password is empty", async () => {
      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "Password is required", email: "admin@example.com" });
    });

    it("returns error when password is not provided", async () => {
      const formData = new FormData();
      formData.append("email", "admin@example.com");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "Password is required", email: "admin@example.com" });
    });

    it("returns error when Better Auth returns invalid credentials", async () => {
      const mockResponse = new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      signInEmailMock.mockResolvedValue(mockResponse);

      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "wrongpassword");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(auth.api.signInEmail).toHaveBeenCalledWith({
        body: { email: "admin@example.com", password: "wrongpassword" },
        asResponse: true,
      });
      expect(response).toEqual({ error: "Invalid credentials", email: "admin@example.com" });
    });

    it("redirects to dashboard when user is a platform member", async () => {
      const mockCookie = "better_auth_session=test123; Path=/; HttpOnly; SameSite=Lax";
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-1", email: "admin@example.com" } }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": mockCookie,
          },
        }
      );
      signInEmailMock.mockResolvedValue(mockResponse);

      // Mock platform org lookup
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "platform-org-id", slug: "platform" }]),
      };

      // Mock platform membership lookup
      const mockMemberQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ userId: "user-1", organizationId: "platform-org-id", role: "owner" }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockOrgQuery;
        return mockMemberQuery;
      });

      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "correctpassword");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(auth.api.signInEmail).toHaveBeenCalledWith({
        body: { email: "admin@example.com", password: "correctpassword" },
        asResponse: true,
      });
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/dashboard");
    });

    it("returns notPlatformMember when user is not a platform member", async () => {
      const mockCookie = "better_auth_session=test123; Path=/; HttpOnly; SameSite=Lax";
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-1", email: "notadmin@example.com" } }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": mockCookie,
          },
        }
      );
      signInEmailMock.mockResolvedValue(mockResponse);

      // Mock platform org lookup
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "platform-org-id", slug: "platform" }]),
      };

      // Mock platform membership lookup - no membership found
      const mockMemberQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockOrgQuery;
        return mockMemberQuery;
      });

      const formData = new FormData();
      formData.append("email", "notadmin@example.com");
      formData.append("password", "correctpassword");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      const responseData = await (response as Response).json();
      expect(responseData).toEqual({ notPlatformMember: { email: "notadmin@example.com" } });
    });

    it("uses custom redirect path when provided", async () => {
      const mockCookie = "better_auth_session=test123; Path=/; HttpOnly; SameSite=Lax";
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-1", email: "admin@example.com" } }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": mockCookie,
          },
        }
      );
      signInEmailMock.mockResolvedValue(mockResponse);

      // Mock platform org lookup
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "platform-org-id", slug: "platform" }]),
      };

      // Mock platform membership lookup
      const mockMemberQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ userId: "user-1", organizationId: "platform-org-id", role: "admin" }]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockOrgQuery;
        return mockMemberQuery;
      });

      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "correctpassword");
      formData.append("redirectTo", "/tenants/oceanblue");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/tenants/oceanblue");
    });

    it("handles Better Auth API errors gracefully", async () => {
      signInEmailMock.mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "password123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "An error occurred during login. Please try again.", email: "admin@example.com" });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns error when platform organization not found", async () => {
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-1", email: "admin@example.com" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
      signInEmailMock.mockResolvedValue(mockResponse);

      // Mock platform org lookup - not found
      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockOrgQuery);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "password123");

      const request = new Request("https://admin.divestreams.com/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toEqual({ error: "Platform configuration error. Please contact support.", email: "admin@example.com" });

      consoleSpy.mockRestore();
    });
  });
});
