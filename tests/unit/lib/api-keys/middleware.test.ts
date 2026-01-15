/**
 * API Key Middleware Tests
 *
 * Tests for API key authentication middleware functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractApiKey,
  validateApiKeyFromRequest,
  requireApiKey,
  hasPermission,
  hasScope,
  requirePermission,
  requireScope,
  type ApiKeyContext,
} from "../../../../lib/api-keys/middleware.server";

// Mock the validateApiKey function from index.server
vi.mock("../../../../lib/api-keys/index.server", () => ({
  validateApiKey: vi.fn(),
}));

import { validateApiKey } from "../../../../lib/api-keys/index.server";

describe("API Key Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("extractApiKey", () => {
    it("extracts key from Authorization header with Bearer prefix", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_abc123",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBe("dk_live_abc123");
    });

    it("extracts key from Authorization header case-insensitively", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "bearer dk_live_xyz789",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBe("dk_live_xyz789");
    });

    it("extracts key from X-API-Key header", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          "X-API-Key": "dk_test_def456",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBe("dk_test_def456");
    });

    it("prefers Authorization header over X-API-Key", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_preferred",
          "X-API-Key": "dk_test_fallback",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBe("dk_live_preferred");
    });

    it("returns null when no API key headers present", () => {
      const request = new Request("http://localhost:3000/api/test");

      const key = extractApiKey(request);
      expect(key).toBeNull();
    });

    it("returns null for invalid Authorization format", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Basic abc123",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBeNull();
    });

    it("returns null for empty Authorization header", () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "",
        },
      });

      const key = extractApiKey(request);
      expect(key).toBeNull();
    });
  });

  describe("validateApiKeyFromRequest", () => {
    it("returns error when no API key provided", async () => {
      const request = new Request("http://localhost:3000/api/test");

      const result = await validateApiKeyFromRequest(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toContain("Missing API key");
      }
    });

    it("returns error for invalid key format", async () => {
      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer invalid_key_format",
        },
      });

      const result = await validateApiKeyFromRequest(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toContain("Invalid API key format");
      }
    });

    it("returns error when key validation fails", async () => {
      vi.mocked(validateApiKey).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_invalid123",
        },
      });

      const result = await validateApiKeyFromRequest(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toContain("Invalid or expired API key");
      }
    });

    it("returns success with context for valid live key", async () => {
      const mockContext: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test Org",
        orgSlug: "test-org",
        keyId: "key-1",
        keyName: "Test Key",
        permissions: { read: true, write: true },
      };
      vi.mocked(validateApiKey).mockResolvedValue(mockContext);

      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_valid123456789012345678901234",
        },
      });

      const result = await validateApiKeyFromRequest(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.orgId).toBe("org-1");
        expect(result.context.keyName).toBe("Test Key");
      }
    });

    it("returns success with context for valid test key", async () => {
      const mockContext: ApiKeyContext = {
        orgId: "org-2",
        orgName: "Test Org 2",
        orgSlug: "test-org-2",
        keyId: "key-2",
        keyName: "Test Key 2",
        permissions: null,
      };
      vi.mocked(validateApiKey).mockResolvedValue(mockContext);

      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          "X-API-Key": "dk_test_valid123456789012345678901234",
        },
      });

      const result = await validateApiKeyFromRequest(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.orgId).toBe("org-2");
      }
    });
  });

  describe("requireApiKey", () => {
    it("returns context for valid key", async () => {
      const mockContext: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test Org",
        orgSlug: "test-org",
        keyId: "key-1",
        keyName: "Test Key",
        permissions: { read: true },
      };
      vi.mocked(validateApiKey).mockResolvedValue(mockContext);

      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_valid123456789012345678901234",
        },
      });

      const context = await requireApiKey(request);

      expect(context.orgId).toBe("org-1");
      expect(context.keyName).toBe("Test Key");
    });

    it("throws Response for missing key", async () => {
      const request = new Request("http://localhost:3000/api/test");

      await expect(requireApiKey(request)).rejects.toBeInstanceOf(Response);
    });

    it("throws Response with 401 status for invalid key", async () => {
      vi.mocked(validateApiKey).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/test", {
        headers: {
          Authorization: "Bearer dk_live_invalid123",
        },
      });

      try {
        await requireApiKey(request);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toContain("Invalid or expired");
      }
    });
  });

  describe("hasPermission", () => {
    it("returns true when permission is granted", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true, write: false, delete: false },
      };

      expect(hasPermission(context, "read")).toBe(true);
    });

    it("returns false when permission is denied", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true, write: false, delete: false },
      };

      expect(hasPermission(context, "write")).toBe(false);
      expect(hasPermission(context, "delete")).toBe(false);
    });

    it("returns true when permissions are null (full access)", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: null,
      };

      expect(hasPermission(context, "read")).toBe(true);
      expect(hasPermission(context, "write")).toBe(true);
      expect(hasPermission(context, "delete")).toBe(true);
    });

    it("returns false when permission is undefined", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true },
      };

      expect(hasPermission(context, "write")).toBe(false);
    });
  });

  describe("hasScope", () => {
    it("returns true when scope is present", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { scopes: ["bookings:read", "customers:write"] },
      };

      expect(hasScope(context, "bookings:read")).toBe(true);
      expect(hasScope(context, "customers:write")).toBe(true);
    });

    it("returns false when scope is not present", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { scopes: ["bookings:read"] },
      };

      expect(hasScope(context, "customers:read")).toBe(false);
    });

    it("returns true when scopes are null (full access)", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: null,
      };

      expect(hasScope(context, "any:scope")).toBe(true);
    });

    it("returns true when permissions have no scopes (full access)", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true },
      };

      expect(hasScope(context, "any:scope")).toBe(true);
    });
  });

  describe("requirePermission", () => {
    it("does not throw when permission is granted", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { write: true },
      };

      expect(() => requirePermission(context, "write")).not.toThrow();
    });

    it("throws Response when permission is denied", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true, write: false },
      };

      expect(() => requirePermission(context, "write")).toThrow(Response);
    });

    it("throws Response with 403 status", async () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { read: true },
      };

      try {
        requirePermission(context, "delete");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.error).toContain("delete");
        expect(body.error).toContain("permission");
      }
    });
  });

  describe("requireScope", () => {
    it("does not throw when scope is granted", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { scopes: ["bookings:read", "bookings:write"] },
      };

      expect(() => requireScope(context, "bookings:read")).not.toThrow();
    });

    it("throws Response when scope is not granted", () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { scopes: ["bookings:read"] },
      };

      expect(() => requireScope(context, "customers:delete")).toThrow(Response);
    });

    it("throws Response with 403 status and scope name", async () => {
      const context: ApiKeyContext = {
        orgId: "org-1",
        orgName: "Test",
        orgSlug: "test",
        keyId: "key-1",
        keyName: "Test",
        permissions: { scopes: [] },
      };

      try {
        requireScope(context, "trips:manage");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.error).toContain("trips:manage");
        expect(body.error).toContain("scope");
      }
    });
  });
});
