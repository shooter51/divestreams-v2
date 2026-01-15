/**
 * API Keys Module Tests
 *
 * Tests for pure functions in the API keys module.
 * Database operations are tested separately in integration tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module with importOriginal to preserve crypto dependency
vi.mock("../../../../lib/db", async (importOriginal) => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("../../../../lib/db/schema/api-keys", () => ({
  apiKeys: { id: "id", organizationId: "organizationId", keyHash: "keyHash" },
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
});
