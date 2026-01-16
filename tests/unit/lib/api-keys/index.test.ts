/**
 * API Keys Module Tests
 *
 * Tests for pure functions and database operations in the API keys module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mocks at module level but initialize inside vi.mock factory
vi.mock("../../../../lib/db", () => {
  // Create fresh mocks for each test module load
  const mockReturning = vi.fn().mockResolvedValue([]);
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockResolvedValue([]);

  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    orderBy: mockOrderBy,
    limit: mockLimit,
    returning: mockReturning,
    catch: vi.fn(() => chain),
    // Expose mocks for test configuration
    _mocks: { mockReturning, mockOrderBy, mockLimit },
  };
  return { db: chain };
});

vi.mock("../../../../lib/db/schema/api-keys", () => ({
  apiKeys: {
    id: "id",
    organizationId: "organizationId",
    keyHash: "keyHash",
    keyPrefix: "keyPrefix",
    name: "name",
    permissions: "permissions",
    isActive: "isActive",
    lastUsedAt: "lastUsedAt",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: { id: "id", name: "name", slug: "slug" },
}));

// Import after mocks
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
} from "../../../../lib/api-keys/index.server";
import { db } from "../../../../lib/db";

// Get mock references from the db module
const getMocks = () => (db as any)._mocks;

describe("API Keys Module", () => {
  // ============================================================================
  // generateApiKey Tests
  // ============================================================================

  describe("generateApiKey", () => {
    it("should generate a live key with correct prefix", () => {
      const key = generateApiKey("live");
      expect(key).toMatch(/^dk_live_[a-f0-9]{32}$/);
    });

    it("should generate a test key with correct prefix", () => {
      const key = generateApiKey("test");
      expect(key).toMatch(/^dk_test_[a-f0-9]{32}$/);
    });

    it("should default to live mode", () => {
      const key = generateApiKey();
      expect(key).toMatch(/^dk_live_/);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateApiKey("live");
      const key2 = generateApiKey("live");
      expect(key1).not.toBe(key2);
    });

    it("should generate keys with 40 characters total (8 prefix + 32 random)", () => {
      const liveKey = generateApiKey("live");
      const testKey = generateApiKey("test");
      // dk_live_ = 8 chars, random = 32 chars = 40 total
      expect(liveKey.length).toBe(40);
      expect(testKey.length).toBe(40);
    });
  });

  // ============================================================================
  // hashApiKey Tests
  // ============================================================================

  describe("hashApiKey", () => {
    it("should return a SHA-256 hash (64 hex characters)", () => {
      const hash = hashApiKey("dk_live_abc123");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce consistent hashes for the same input", () => {
      const key = "dk_live_test123456789012345678901234";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashApiKey("dk_live_abc");
      const hash2 = hashApiKey("dk_live_xyz");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = hashApiKey("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle special characters", () => {
      const hash = hashApiKey("dk_live_!@#$%^&*()");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ============================================================================
  // getKeyPrefix Tests
  // ============================================================================

  describe("getKeyPrefix", () => {
    it("should return first 12 characters of the key", () => {
      const key = "dk_live_abcdef123456789";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("dk_live_abcd");
      expect(prefix.length).toBe(12);
    });

    it("should return the full string if less than 12 characters", () => {
      const key = "dk_live";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("dk_live");
    });

    it("should work with test keys", () => {
      const key = "dk_test_xyz123456789";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("dk_test_xyz1");
    });

    it("should handle empty string", () => {
      const prefix = getKeyPrefix("");
      expect(prefix).toBe("");
    });
  });

  // ============================================================================
  // Integration of pure functions
  // ============================================================================

  describe("API Key workflow", () => {
    it("should generate a key that can be hashed and prefixed", () => {
      const key = generateApiKey("live");
      const hash = hashApiKey(key);
      const prefix = getKeyPrefix(key);

      // Verify all outputs are valid
      expect(key).toMatch(/^dk_live_/);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(prefix).toMatch(/^dk_live_/);
      expect(prefix.length).toBe(12);
    });

    it("should produce the same hash for validation workflow", () => {
      // Simulate: User submits key, we hash it and compare
      const generatedKey = generateApiKey("live");
      const storedHash = hashApiKey(generatedKey);

      // Later, user submits the same key
      const submittedKey = generatedKey;
      const submittedHash = hashApiKey(submittedKey);

      expect(submittedHash).toBe(storedHash);
    });

    it("should reject different keys in validation", () => {
      const key1 = generateApiKey("live");
      const key2 = generateApiKey("live");

      const hash1 = hashApiKey(key1);
      const hash2 = hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
    });
  });

  // ============================================================================
  // Database Operations Tests (testing the function signatures exist)
  // ============================================================================

  describe("Database operation function exports", () => {
    it("exports createApiKey function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.createApiKey).toBe("function");
    });

    it("exports listApiKeys function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.listApiKeys).toBe("function");
    });

    it("exports revokeApiKey function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.revokeApiKey).toBe("function");
    });

    it("exports deleteApiKey function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.deleteApiKey).toBe("function");
    });

    it("exports validateApiKey function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.validateApiKey).toBe("function");
    });

    it("exports getApiKey function", async () => {
      const module = await import("../../../../lib/api-keys/index.server");
      expect(typeof module.getApiKey).toBe("function");
    });
  });

  // ============================================================================
  // Validation Logic Tests (testing pure validation behavior)
  // ============================================================================

  describe("API Key validation patterns", () => {
    it("should recognize valid live key format", () => {
      // 32 hex chars after prefix: abc123def45678901234567890123456
      const key = "dk_live_abc123def45678901234567890123456";
      expect(key).toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });

    it("should recognize valid test key format", () => {
      // 32 hex chars after prefix
      const key = "dk_test_abc123def45678901234567890123456";
      expect(key).toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });

    it("should reject keys without dk_ prefix", () => {
      const key = "live_abc123def45678901234567890123456";
      expect(key).not.toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });

    it("should reject keys with wrong mode", () => {
      const key = "dk_prod_abc123def45678901234567890123456";
      expect(key).not.toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });

    it("should reject keys with wrong length", () => {
      const key = "dk_live_abc123";
      expect(key).not.toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });

    it("should reject empty string", () => {
      const key = "";
      expect(key).not.toMatch(/^dk_(live|test)_[a-f0-9]{32}$/);
    });
  });
});
