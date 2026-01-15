/**
 * Platform Context Tests
 *
 * Tests for platform admin authentication and authorization.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PLATFORM_ORG_SLUG,
  requirePlatformAdmin,
  type PlatformContext,
} from "../../../../lib/auth/platform-context.server";

// Mock the auth module
vi.mock("../../../../lib/auth/index", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock the db module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("platform-context.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PLATFORM_ORG_SLUG", () => {
    it("should be set to 'platform'", () => {
      expect(PLATFORM_ORG_SLUG).toBe("platform");
    });
  });

  describe("requirePlatformAdmin", () => {
    function createMockPlatformContext(overrides: Partial<PlatformContext> = {}): PlatformContext {
      return {
        user: { id: "user-1", name: "Admin", email: "admin@example.com" } as any,
        session: { id: "session-1" } as any,
        membership: { role: "admin" } as any,
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
