/**
 * Platform Admin Validation Tests
 *
 * Comprehensive tests for requirePlatformAdmin function.
 * Tests platform admin authorization and error handling.
 */

import { describe, it, expect } from "vitest";
import {
  requirePlatformAdmin,
  type PlatformContext,
  PLATFORM_ORG_SLUG,
} from "../../../../lib/auth/platform-context.server";

describe("requirePlatformAdmin", () => {
  // Helper to create mock platform context
  function createMockContext(
    role: "owner" | "admin" | "staff" | "customer"
  ): PlatformContext {
    const isOwner = role === "owner";
    const isAdmin = role === "owner" || role === "admin";

    return {
      user: {
        id: "user-1",
        name: "Platform Admin",
        email: "admin@divestreams.com",
      } as any,
      session: { id: "session-1" } as any,
      membership: {
        role: role,
        userId: "user-1",
        organizationId: "platform-org-id",
      } as any,
      isOwner,
      isAdmin,
    };
  }

  // ============================================================================
  // Admin Access
  // ============================================================================

  describe("Admin access", () => {
    it("should allow owner (isAdmin = true)", () => {
      const context = createMockContext("owner");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should allow admin (isAdmin = true)", () => {
      const context = createMockContext("admin");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should verify isOwner is true for owner", () => {
      const context = createMockContext("owner");
      expect(context.isOwner).toBe(true);
      expect(context.isAdmin).toBe(true);
    });

    it("should verify isOwner is false for admin", () => {
      const context = createMockContext("admin");
      expect(context.isOwner).toBe(false);
      expect(context.isAdmin).toBe(true);
    });
  });

  // ============================================================================
  // Non-Admin Access Denied
  // ============================================================================

  describe("Non-admin access denied", () => {
    it("should deny staff (isAdmin = false)", () => {
      const context = createMockContext("staff");
      expect(() => requirePlatformAdmin(context)).toThrow(Response);
    });

    it("should deny customer (isAdmin = false)", () => {
      const context = createMockContext("customer");
      expect(() => requirePlatformAdmin(context)).toThrow(Response);
    });

    it("should verify isAdmin is false for staff", () => {
      const context = createMockContext("staff");
      expect(context.isAdmin).toBe(false);
    });

    it("should verify isAdmin is false for customer", () => {
      const context = createMockContext("customer");
      expect(context.isAdmin).toBe(false);
    });
  });

  // ============================================================================
  // Error Response
  // ============================================================================

  describe("Error response", () => {
    it("should throw Response object when denied", () => {
      const context = createMockContext("staff");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
      }
    });

    it("should have 403 status code", () => {
      const context = createMockContext("staff");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(403);
      }
    });

    it("should have Forbidden status text", () => {
      const context = createMockContext("staff");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).statusText).toBe("Forbidden");
      }
    });

    it("should include platform admin in error message", async () => {
      const context = createMockContext("staff");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        const text = await (error as Response).text();
        expect(text).toContain("Platform admin access required");
      }
    });

    it("should include Forbidden in error message", async () => {
      const context = createMockContext("customer");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        const text = await (error as Response).text();
        expect(text).toContain("Forbidden");
      }
    });
  });

  // ============================================================================
  // Context Validation
  // ============================================================================

  describe("Context validation", () => {
    it("should validate isAdmin flag correctly for owner", () => {
      const context = createMockContext("owner");
      expect(context.isAdmin).toBe(true);
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should validate isAdmin flag correctly for admin", () => {
      const context = createMockContext("admin");
      expect(context.isAdmin).toBe(true);
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should validate isAdmin flag correctly for staff", () => {
      const context = createMockContext("staff");
      expect(context.isAdmin).toBe(false);
      expect(() => requirePlatformAdmin(context)).toThrow();
    });

    it("should validate isAdmin flag correctly for customer", () => {
      const context = createMockContext("customer");
      expect(context.isAdmin).toBe(false);
      expect(() => requirePlatformAdmin(context)).toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle context with false isAdmin explicitly", () => {
      const context: PlatformContext = {
        user: { id: "user-1", name: "Test", email: "test@example.com" } as any,
        session: { id: "session-1" } as any,
        membership: { role: "staff" } as any,
        isOwner: false,
        isAdmin: false,
      };

      expect(() => requirePlatformAdmin(context)).toThrow(Response);
    });

    it("should handle context with true isAdmin explicitly", () => {
      const context: PlatformContext = {
        user: { id: "user-1", name: "Test", email: "test@example.com" } as any,
        session: { id: "session-1" } as any,
        membership: { role: "admin" } as any,
        isOwner: false,
        isAdmin: true,
      };

      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should work regardless of isOwner if isAdmin is true", () => {
      const contextOwner: PlatformContext = {
        user: { id: "user-1", name: "Test", email: "test@example.com" } as any,
        session: { id: "session-1" } as any,
        membership: { role: "owner" } as any,
        isOwner: true,
        isAdmin: true,
      };

      const contextAdmin: PlatformContext = {
        user: { id: "user-2", name: "Test", email: "test@example.com" } as any,
        session: { id: "session-2" } as any,
        membership: { role: "admin" } as any,
        isOwner: false,
        isAdmin: true,
      };

      expect(() => requirePlatformAdmin(contextOwner)).not.toThrow();
      expect(() => requirePlatformAdmin(contextAdmin)).not.toThrow();
    });
  });

  // ============================================================================
  // Consistency
  // ============================================================================

  describe("Consistency", () => {
    it("should be consistent for same context", () => {
      const context = createMockContext("staff");

      const call1 = () => requirePlatformAdmin(context);
      const call2 = () => requirePlatformAdmin(context);

      expect(call1).toThrow();
      expect(call2).toThrow();
    });

    it("should always allow when isAdmin is true", () => {
      const contexts = [
        createMockContext("owner"),
        createMockContext("admin"),
      ];

      contexts.forEach(context => {
        expect(() => requirePlatformAdmin(context)).not.toThrow();
      });
    });

    it("should always deny when isAdmin is false", () => {
      const contexts = [
        createMockContext("staff"),
        createMockContext("customer"),
      ];

      contexts.forEach(context => {
        expect(() => requirePlatformAdmin(context)).toThrow(Response);
      });
    });
  });

  // ============================================================================
  // Platform Org Slug Constant
  // ============================================================================

  describe("PLATFORM_ORG_SLUG constant", () => {
    it("should be defined", () => {
      expect(PLATFORM_ORG_SLUG).toBeDefined();
    });

    it("should be a string", () => {
      expect(typeof PLATFORM_ORG_SLUG).toBe("string");
    });

    it("should equal 'platform'", () => {
      expect(PLATFORM_ORG_SLUG).toBe("platform");
    });

    it("should be lowercase", () => {
      expect(PLATFORM_ORG_SLUG).toBe(PLATFORM_ORG_SLUG.toLowerCase());
    });

    it("should not be empty", () => {
      expect(PLATFORM_ORG_SLUG.length).toBeGreaterThan(0);
    });

    it("should not contain whitespace", () => {
      expect(PLATFORM_ORG_SLUG).not.toMatch(/\s/);
    });

    it("should be a valid slug format", () => {
      expect(PLATFORM_ORG_SLUG).toMatch(/^[a-z0-9-]+$/);
    });
  });

  // ============================================================================
  // Real-world Scenarios
  // ============================================================================

  describe("Real-world scenarios", () => {
    it("should allow platform owner to manage tenants", () => {
      const context = createMockContext("owner");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should allow platform admin to manage tenants", () => {
      const context = createMockContext("admin");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
    });

    it("should deny platform staff from managing tenants", () => {
      const context = createMockContext("staff");
      expect(() => requirePlatformAdmin(context)).toThrow(Response);
    });

    it("should allow owner to access sensitive platform settings", () => {
      const context = createMockContext("owner");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
      expect(context.isOwner).toBe(true);
    });

    it("should allow admin to access most platform features", () => {
      const context = createMockContext("admin");
      expect(() => requirePlatformAdmin(context)).not.toThrow();
      expect(context.isAdmin).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error handling", () => {
    it("should provide helpful error for staff", async () => {
      const context = createMockContext("staff");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        const response = error as Response;
        expect(response.status).toBe(403);

        const text = await response.text();
        expect(text).toContain("Forbidden");
        expect(text).toContain("Platform admin access required");
      }
    });

    it("should provide helpful error for customer", async () => {
      const context = createMockContext("customer");

      try {
        requirePlatformAdmin(context);
        expect.fail("Should have thrown");
      } catch (error) {
        const response = error as Response;
        expect(response.status).toBe(403);

        const text = await response.text();
        expect(text).toContain("Forbidden");
        expect(text).toContain("Platform admin access required");
      }
    });

    it("should throw same error for staff and customer", async () => {
      const staffContext = createMockContext("staff");
      const customerContext = createMockContext("customer");

      let staffError: Response | null = null;
      let customerError: Response | null = null;

      try {
        requirePlatformAdmin(staffContext);
      } catch (error) {
        staffError = error as Response;
      }

      try {
        requirePlatformAdmin(customerContext);
      } catch (error) {
        customerError = error as Response;
      }

      expect(staffError).not.toBeNull();
      expect(customerError).not.toBeNull();
      expect(staffError!.status).toBe(customerError!.status);

      const staffText = await staffError!.text();
      const customerText = await customerError!.text();
      expect(staffText).toBe(customerText);
    });
  });
});
