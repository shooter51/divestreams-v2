import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSubdomainFromRequest,
  hasPermission,
  requirePermission,
  PERMISSIONS,
  type UserRole,
  type Permission,
} from "../../../../lib/auth/tenant-auth.server";

// Mock the tenant database module
vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantBySubdomain: vi.fn(),
  getTenantDb: vi.fn(),
}));

describe("tenant-auth.server", () => {
  describe("getSubdomainFromRequest", () => {
    it("extracts subdomain from localhost URL", () => {
      const request = new Request("http://demo.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });

    it("extracts subdomain from production URL", () => {
      const request = new Request("https://testshop.divestreams.com/app");
      expect(getSubdomainFromRequest(request)).toBe("testshop");
    });

    it("returns null for plain localhost", () => {
      const request = new Request("http://localhost:5173");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for main domain without subdomain", () => {
      const request = new Request("https://divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for www subdomain", () => {
      const request = new Request("https://www.divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("handles admin subdomain", () => {
      const request = new Request("http://admin.localhost:5173/dashboard");
      expect(getSubdomainFromRequest(request)).toBe("admin");
    });

    it("handles subdomains with hyphens", () => {
      const request = new Request("http://my-dive-shop.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("my-dive-shop");
    });

    it("handles subdomains with numbers", () => {
      const request = new Request("http://shop123.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("shop123");
    });
  });

  describe("PERMISSIONS", () => {
    it("defines booking permissions correctly", () => {
      expect(PERMISSIONS["bookings:read"]).toContain("owner");
      expect(PERMISSIONS["bookings:read"]).toContain("manager");
      expect(PERMISSIONS["bookings:read"]).toContain("staff");
      expect(PERMISSIONS["bookings:delete"]).not.toContain("staff");
    });

    it("defines settings permissions correctly", () => {
      expect(PERMISSIONS["settings:write"]).toContain("owner");
      expect(PERMISSIONS["settings:write"]).not.toContain("manager");
      expect(PERMISSIONS["settings:write"]).not.toContain("staff");
    });

    it("defines user management permissions correctly", () => {
      expect(PERMISSIONS["users:write"]).toContain("owner");
      expect(PERMISSIONS["users:write"]).not.toContain("manager");
    });
  });

  describe("hasPermission", () => {
    it("returns true when owner has permission", () => {
      expect(hasPermission("owner", "settings:write")).toBe(true);
      expect(hasPermission("owner", "users:delete")).toBe(true);
      expect(hasPermission("owner", "bookings:read")).toBe(true);
    });

    it("returns true when manager has permission", () => {
      expect(hasPermission("manager", "bookings:write")).toBe(true);
      expect(hasPermission("manager", "customers:delete")).toBe(true);
      expect(hasPermission("manager", "reports:read")).toBe(true);
    });

    it("returns false when manager lacks permission", () => {
      expect(hasPermission("manager", "settings:write")).toBe(false);
      expect(hasPermission("manager", "users:delete")).toBe(false);
    });

    it("returns true when staff has permission", () => {
      expect(hasPermission("staff", "bookings:read")).toBe(true);
      expect(hasPermission("staff", "customers:write")).toBe(true);
    });

    it("returns false when staff lacks permission", () => {
      expect(hasPermission("staff", "bookings:delete")).toBe(false);
      expect(hasPermission("staff", "tours:write")).toBe(false);
      expect(hasPermission("staff", "settings:read")).toBe(false);
      expect(hasPermission("staff", "transactions:read")).toBe(false);
    });
  });

  describe("requirePermission", () => {
    it("does not throw when permission is granted", () => {
      expect(() => requirePermission("owner", "settings:write")).not.toThrow();
      expect(() => requirePermission("manager", "bookings:delete")).not.toThrow();
      expect(() => requirePermission("staff", "customers:read")).not.toThrow();
    });

    it("throws 403 response when permission is denied", () => {
      expect(() => requirePermission("staff", "settings:write")).toThrow();
      expect(() => requirePermission("manager", "users:delete")).toThrow();
    });

    it("throws Response with status 403", () => {
      try {
        requirePermission("staff", "tours:delete");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(403);
      }
    });
  });

  describe("Permission coverage", () => {
    const allPermissions: Permission[] = [
      "bookings:read",
      "bookings:write",
      "bookings:delete",
      "customers:read",
      "customers:write",
      "customers:delete",
      "tours:read",
      "tours:write",
      "tours:delete",
      "equipment:read",
      "equipment:write",
      "equipment:delete",
      "transactions:read",
      "transactions:write",
      "reports:read",
      "settings:read",
      "settings:write",
      "users:read",
      "users:write",
      "users:delete",
    ];

    it("owner has access to all permissions", () => {
      for (const permission of allPermissions) {
        expect(hasPermission("owner", permission)).toBe(true);
      }
    });

    it("all defined permissions have at least one role", () => {
      for (const permission of allPermissions) {
        const roles: UserRole[] = ["owner", "manager", "staff"];
        const hasAnyRole = roles.some((role) => hasPermission(role, permission));
        expect(hasAnyRole).toBe(true);
      }
    });
  });
});
