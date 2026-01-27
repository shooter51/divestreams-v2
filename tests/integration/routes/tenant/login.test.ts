import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";

// Track whether we're in a loader context (where redirect throws) or action context (where redirect returns)
let shouldThrowRedirect = false;

// Mock react-router redirect - must be before importing route
const mockRedirect = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string, init?: ResponseInit) => {
      mockRedirect(url, init);
      // Create redirect response
      const response = new Response(null, {
        status: 302,
        headers: {
          Location: url,
          ...(init?.headers || {}),
        },
      });
      // In loader context, redirect throws (using throw redirect())
      // In action context, redirect returns (using return redirect())
      if (shouldThrowRedirect) {
        throw response;
      }
      return response;
    },
  };
});

import { loader, action } from "../../../../app/routes/tenant/login";

// Mock the auth module
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
  },
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}));

import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    shouldThrowRedirect = false; // Reset for each test
  });

  describe("loader", () => {
    it("redirects to /tenant when already logged in", async () => {
      shouldThrowRedirect = true; // loader uses throw redirect()
      (auth.api.getSession as Mock).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
      });

      const request = new Request("https://demo.divestreams.com/login");

      try {
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);
        // Should throw redirect
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect(getRedirectPathname((response as Response).headers.get("Location"))).toBe("/tenant");
      }
    });

    it("redirects to specified path when already logged in with redirect param", async () => {
      shouldThrowRedirect = true; // loader uses throw redirect()
      (auth.api.getSession as Mock).mockResolvedValue({
        user: { id: "user-1", email: "test@example.com" },
      });

      const request = new Request("https://demo.divestreams.com/login?redirect=/tenant/bookings");

      try {
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect(getRedirectPathname((response as Response).headers.get("Location"))).toBe("/tenant/bookings");
      }
    });

    it("returns org info when not logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-1", name: "Demo Dive Shop" }]),
      };

      (db.select as Mock).mockReturnValue(mockOrgQuery);

      const request = new Request("https://demo.divestreams.com/login");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.orgName).toBe("Demo Dive Shop");
      expect(result.orgId).toBe("org-1");
      expect(result.subdomain).toBe("demo");
    });

    it("returns default org name when org not found", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      (getSubdomainFromRequest as Mock).mockReturnValue("unknown");

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock).mockReturnValue(mockOrgQuery);

      const request = new Request("https://unknown.divestreams.com/login");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.orgName).toBe("this shop");
      expect(result.orgId).toBeNull();
    });
  });

  describe("action", () => {
    describe("validation", () => {
      it("returns error when email is empty", async () => {
        const formData = new FormData();
        formData.append("email", "");
        formData.append("password", "password123");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Please enter a valid email address" });
      });

      it("returns error when email is invalid format", async () => {
        const formData = new FormData();
        formData.append("email", "notanemail");
        formData.append("password", "password123");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Please enter a valid email address" });
      });

      it("returns error when password is empty", async () => {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Password is required" });
      });
    });

    describe("login flow", () => {
      it("returns error when credentials are invalid", async () => {
        const mockResponse = new Response(JSON.stringify({ message: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
        (auth.api.signInEmail as Mock).mockResolvedValue(mockResponse);

        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "wrongpassword");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Invalid credentials" });
      });

      it("redirects to /tenant when login is successful and user is a member", async () => {
        const mockCookie = "better_auth_session=test123; Path=/; HttpOnly";
        const mockAuthResponse = new Response(
          JSON.stringify({ user: { id: "user-1", email: "user@example.com" } }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": mockCookie,
            },
          }
        );
        (auth.api.signInEmail as Mock).mockResolvedValue(mockAuthResponse);
        (getSubdomainFromRequest as Mock).mockReturnValue("demo");

        // Mock org lookup
        const mockOrgQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: "org-1", name: "Demo Dive Shop" }]),
        };

        // Mock member lookup
        const mockMemberQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ userId: "user-1", organizationId: "org-1" }]),
        };

        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockOrgQuery;
          return mockMemberQuery;
        });

        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "correctpassword");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect(getRedirectPathname((response as Response).headers.get("Location"))).toBe("/tenant");
      });

      it("returns notMember when user is not a member of the org", async () => {
        const mockCookie = "better_auth_session=test123; Path=/; HttpOnly";
        const mockAuthResponse = new Response(
          JSON.stringify({ user: { id: "user-1", email: "user@example.com" } }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": mockCookie,
            },
          }
        );
        (auth.api.signInEmail as Mock).mockResolvedValue(mockAuthResponse);
        (getSubdomainFromRequest as Mock).mockReturnValue("demo");

        // Mock org lookup
        const mockOrgQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: "org-1", name: "Demo Dive Shop" }]),
        };

        // Mock member lookup - not a member
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
        formData.append("email", "user@example.com");
        formData.append("password", "correctpassword");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toBeInstanceOf(Response);
        const responseData = await (response as Response).json();
        expect(responseData.notMember).toBeDefined();
        expect(responseData.notMember.orgName).toBe("Demo Dive Shop");
        expect(responseData.notMember.email).toBe("user@example.com");
      });
    });

    describe("join intent", () => {
      it("adds user as customer to organization", async () => {
        // Mock that user is not already a member
        const mockMemberCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        // db.insert(table).values({...}) - need to return object with values method
        const mockInsertChain = {
          values: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockMemberCheckQuery);
        (db.insert as Mock).mockReturnValue(mockInsertChain);

        const formData = new FormData();
        formData.append("intent", "join");
        formData.append("userId", "user-1");
        formData.append("orgId", "org-1");
        formData.append("redirectTo", "/tenant");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // redirect() returns a Response in React Router v7
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect(getRedirectPathname((response as Response).headers.get("Location"))).toBe("/tenant");
        expect(db.insert).toHaveBeenCalled();
      });

      it("returns error when userId is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "join");
        formData.append("orgId", "org-1");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Missing user or organization information" });
      });

      it("returns error when orgId is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "join");
        formData.append("userId", "user-1");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "Missing user or organization information" });
      });

      it("does not create duplicate membership", async () => {
        // Mock that user is already a member
        const mockMemberCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ userId: "user-1", organizationId: "org-1" }]),
        };

        (db.select as Mock).mockReturnValue(mockMemberCheckQuery);

        const formData = new FormData();
        formData.append("intent", "join");
        formData.append("userId", "user-1");
        formData.append("orgId", "org-1");
        formData.append("redirectTo", "/tenant");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // redirect() returns a Response in React Router v7
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);

        // Should not call insert since user is already a member
        expect(db.insert).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("handles auth API errors gracefully", async () => {
        (auth.api.signInEmail as Mock).mockRejectedValue(new Error("Network error"));

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "password123");

        const request = new Request("https://demo.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response).toEqual({ error: "An error occurred during login. Please try again." });
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });
});
