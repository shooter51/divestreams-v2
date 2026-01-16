/**
 * API Keys Schema Tests
 *
 * Tests for API key types and interfaces.
 */

import { describe, it, expect } from "vitest";
import {
  type ApiKeyPermissions,
  type ApiKeyDisplay,
} from "../../../../../lib/db/schema/api-keys";

describe("api-keys schema", () => {
  describe("ApiKeyPermissions", () => {
    it("supports read permission", () => {
      const permissions: ApiKeyPermissions = { read: true };
      expect(permissions.read).toBe(true);
    });

    it("supports write permission", () => {
      const permissions: ApiKeyPermissions = { write: true };
      expect(permissions.write).toBe(true);
    });

    it("supports delete permission", () => {
      const permissions: ApiKeyPermissions = { delete: true };
      expect(permissions.delete).toBe(true);
    });

    it("supports scopes array", () => {
      const permissions: ApiKeyPermissions = {
        read: true,
        scopes: ["bookings:read", "customers:write"],
      };
      expect(permissions.scopes).toEqual(["bookings:read", "customers:write"]);
    });

    it("supports all permissions combined", () => {
      const permissions: ApiKeyPermissions = {
        read: true,
        write: true,
        delete: false,
        scopes: ["bookings:*"],
      };
      expect(permissions.read).toBe(true);
      expect(permissions.write).toBe(true);
      expect(permissions.delete).toBe(false);
      expect(permissions.scopes).toEqual(["bookings:*"]);
    });

    it("allows empty object", () => {
      const permissions: ApiKeyPermissions = {};
      expect(Object.keys(permissions)).toHaveLength(0);
    });
  });

  describe("ApiKeyDisplay", () => {
    it("has required fields", () => {
      const key: ApiKeyDisplay = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Production API Key",
        keyPrefix: "dk_live_abc1",
        permissions: { read: true, write: true },
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
      };

      expect(key.id).toBeDefined();
      expect(key.name).toBe("Production API Key");
      expect(key.keyPrefix).toBe("dk_live_abc1");
      expect(key.isActive).toBe(true);
    });

    it("supports null permissions", () => {
      const key: ApiKeyDisplay = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Basic Key",
        keyPrefix: "dk_live_xyz1",
        permissions: null,
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
      };

      expect(key.permissions).toBeNull();
    });

    it("supports lastUsedAt date", () => {
      const lastUsed = new Date("2025-01-15T10:00:00Z");
      const key: ApiKeyDisplay = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Active Key",
        keyPrefix: "dk_live_abc1",
        permissions: { read: true },
        isActive: true,
        lastUsedAt: lastUsed,
        expiresAt: null,
        createdAt: new Date(),
      };

      expect(key.lastUsedAt).toEqual(lastUsed);
    });

    it("supports expiresAt date", () => {
      const expiresAt = new Date("2025-12-31T23:59:59Z");
      const key: ApiKeyDisplay = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Expiring Key",
        keyPrefix: "dk_live_abc1",
        permissions: { read: true },
        isActive: true,
        lastUsedAt: null,
        expiresAt: expiresAt,
        createdAt: new Date(),
      };

      expect(key.expiresAt).toEqual(expiresAt);
    });

    it("keyPrefix follows expected format", () => {
      const key: ApiKeyDisplay = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Key",
        keyPrefix: "dk_live_abc1",
        permissions: null,
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
      };

      // keyPrefix should be 12 characters
      expect(key.keyPrefix.length).toBe(12);
      // Should start with dk_live_ or dk_test_
      expect(key.keyPrefix).toMatch(/^dk_(live|test)_/);
    });
  });
});
