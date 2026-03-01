/**
 * Platform Context Tests
 *
 * Tests for platform admin authentication and authorization.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PLATFORM_ORG_SLUG,
  requirePlatformAdmin,
  getPlatformContext,
  requirePlatformContext,
  type PlatformContext,
} from "../../../../lib/auth/platform-context.server";

// Create chain mock using vi.hoisted
const { mockGetSession, dbMock, mockLimit, resetMocks } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockLimit = vi.fn().mockResolvedValue([]);

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = mockLimit;
  // Thenable
  chain.then = (resolve: (value: unknown[]) => void) => {
    resolve([]);
    return chain;
  };

  const resetMocks = () => {
    mockGetSession.mockClear();
    Object.values(chain).forEach((mock) => {
      if (typeof mock === "function" && mock.mockClear) {
        mock.mockClear();
      }
    });
    mockLimit.mockClear();
    mockLimit.mockResolvedValue([]);
  };

  return { mockGetSession, dbMock: chain, mockLimit, resetMocks };
});

// Mock the auth module
vi.mock("../../../../lib/auth/index", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Mock the db module
vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

// Mock org-context.server for isAdminSubdomain
vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn((request) => {
    const url = new URL(request.url);
    return url.hostname === "admin.divestreams.com";
  }),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
}));

// Mock react-router redirect
vi.mock("react-router", () => ({
  redirect: vi.fn((path) => {
    const error = new Response(null, { status: 302, headers: { Location: path } });
    throw error;
  }),
}));

describe("platform-context.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe("PLATFORM_ORG_SLUG", () => {
    it("should be set to 'platform'", () => {
      expect(PLATFORM_ORG_SLUG).toBe("platform");
    });
  });

  // ============================================================================
  // getPlatformContext Tests
  // ============================================================================
  describe("getPlatformContext", () => {
    function createMockRequest(url: string): Request {
      return new Request(url, {
        headers: new Headers({ Cookie: "session=test" }),
      });
    }

    it("returns null for non-admin subdomain requests", async () => {
      const request = createMockRequest("https://demo.divestreams.com/dashboard");

      const context = await getPlatformContext(request);

      expect(context).toBeNull();
    });

    it("returns null when no session exists", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = createMockRequest("https://admin.divestreams.com/dashboard");

      const context = await getPlatformContext(request);

      expect(context).toBeNull();
      expect(mockGetSession).toHaveBeenCalled();
    });

    it("returns null when session has no user", async () => {
      mockGetSession.mockResolvedValueOnce({ session: { id: "s1" }, user: null });
      const request = createMockRequest("https://admin.divestreams.com/dashboard");

      const context = await getPlatformContext(request);

      expect(context).toBeNull();
    });

    it("returns null when platform org not found", async () => {
      mockGetSession.mockResolvedValueOnce({
        session: { id: "s1" },
        user: { id: "u1", name: "Admin" },
      });
      mockLimit.mockResolvedValueOnce([]); // No platform org

      const request = createMockRequest("https://admin.divestreams.com/dashboard");
      const context = await getPlatformContext(request);

      expect(context).toBeNull();
    });

    it("returns null when user is not a platform member", async () => {
      mockGetSession.mockResolvedValueOnce({
        session: { id: "s1" },
        user: { id: "u1", name: "Admin" },
      });
      mockLimit
        .mockResolvedValueOnce([{ id: "org-platform", slug: "platform" }]) // Platform org found
        .mockResolvedValueOnce([]); // No membership

      const request = createMockRequest("https://admin.divestreams.com/dashboard");
      const context = await getPlatformContext(request);

      expect(context).toBeNull();
    });

    it("calls auth.api.getSession with request headers", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = createMockRequest("https://admin.divestreams.com/test");

      await getPlatformContext(request);

      expect(mockGetSession).toHaveBeenCalledWith({
        headers: request.headers,
      });
    });

    it("queries database for platform organization", async () => {
      mockGetSession.mockResolvedValueOnce({
        session: { id: "s1" },
        user: { id: "u1", name: "Admin" },
      });
      mockLimit.mockResolvedValueOnce([]); // No org found

      const request = createMockRequest("https://admin.divestreams.com/dashboard");
      await getPlatformContext(request);

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // requirePlatformContext Tests
  // ============================================================================
  describe("requirePlatformContext", () => {
    it("throws redirect when context is null", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = new Request("https://admin.divestreams.com/dashboard");

      await expect(requirePlatformContext(request)).rejects.toThrow();
    });

    it("redirects to login with path preserved", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = new Request("https://admin.divestreams.com/settings");

      try {
        await requirePlatformContext(request);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(302);
        const location = response.headers.get("Location");
        expect(location).toContain("/login");
        expect(location).toContain("redirect=");
      }
    });

    it("calls getPlatformContext with the request", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const request = new Request("https://admin.divestreams.com/test");

      try {
        await requirePlatformContext(request);
      } catch {
        // Expected
      }

      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  describe("requirePlatformAdmin", () => {
    function createMockPlatformContext(overrides: Partial<PlatformContext> = {}): PlatformContext {
      return {
        user: { id: "user-1", name: "Admin", email: "admin@example.com" } as unknown,
        session: { id: "session-1" } as unknown,
        membership: { role: "admin" } as unknown,
        isOwner: false,
        isAdmin: true,
        ...overrides,
      };
    }

    it("should not throw when user is an admin", () => {
      const context = createMockPlatformContext({ isAdmin: true });
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should not throw when user is an owner", () => {
      const context = createMockPlatformContext({ isOwner: true, isAdmin: true });
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should throw 403 when user is not an admin", () => {
      const context = createMockPlatformContext({ isAdmin: false, isOwner: false });

      expect(() => requirePlatformAdmin(context)).toThrow();

      try {
        requirePlatformAdmin(context);
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        expect(response.statusText).toBe("Forbidden");
      }
    });

    it("should throw with appropriate error message", async () => {
      const context = createMockPlatformContext({ isAdmin: false });

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Platform admin access required");
      }
    });
  });
});
