/**
 * API Keys Tests
 *
 * Tests for API key generation, hashing, and utility functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
} from "../../../../lib/api-keys/index.server";

describe("api-keys", () => {
  // ============================================================================
  // generateApiKey Tests
  // ============================================================================
  describe("generateApiKey", () => {
    it("generates a live key by default", () => {
      const key = generateApiKey();
      expect(key.startsWith("dk_live_")).toBe(true);
    });

    it("generates a live key when mode is live", () => {
      const key = generateApiKey("live");
      expect(key.startsWith("dk_live_")).toBe(true);
    });

    it("generates a test key when mode is test", () => {
      const key = generateApiKey("test");
      expect(key.startsWith("dk_test_")).toBe(true);
    });

    it("generates key with correct length", () => {
      const key = generateApiKey();
      // Prefix (8 chars: dk_live_ or dk_test_) + 32 hex chars = 40 chars
      expect(key.length).toBe(40);
    });

    it("generates hex characters after prefix", () => {
      const key = generateApiKey();
      const hexPart = key.slice(8); // Skip "dk_live_"
      expect(hexPart).toMatch(/^[0-9a-f]+$/);
      expect(hexPart.length).toBe(32);
    });

    it("generates unique keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey());
      }
      expect(keys.size).toBe(100);
    });

    it("generates unique live keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 50; i++) {
        keys.add(generateApiKey("live"));
      }
      expect(keys.size).toBe(50);
    });

    it("generates unique test keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 50; i++) {
        keys.add(generateApiKey("test"));
      }
      expect(keys.size).toBe(50);
    });
  });

  // ============================================================================
  // hashApiKey Tests
  // ============================================================================
  describe("hashApiKey", () => {
    it("returns a SHA-256 hash", () => {
      const key = "dk_live_abc123";
      const hash = hashApiKey(key);

      // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns consistent hash for same key", () => {
      const key = "dk_live_test1234567890";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it("returns different hashes for different keys", () => {
      const hash1 = hashApiKey("dk_live_key1");
      const hash2 = hashApiKey("dk_live_key2");

      expect(hash1).not.toBe(hash2);
    });

    it("hashes live and test keys differently", () => {
      const liveHash = hashApiKey("dk_live_abc123");
      const testHash = hashApiKey("dk_test_abc123");

      expect(liveHash).not.toBe(testHash);
    });

    it("handles empty string", () => {
      const hash = hashApiKey("");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles special characters", () => {
      const hash = hashApiKey("dk_live_key!@#$%");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles unicode characters", () => {
      const hash = hashApiKey("dk_live_key_\u00e9\u00f1");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ============================================================================
  // getKeyPrefix Tests
  // ============================================================================
  describe("getKeyPrefix", () => {
    it("returns first 12 characters of key", () => {
      const key = "dk_live_abc123def456";
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe("dk_live_abc1");
      expect(prefix.length).toBe(12);
    });

    it("returns entire key if shorter than 12 characters", () => {
      const key = "short";
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe("short");
    });

    it("extracts prefix from live key", () => {
      const key = generateApiKey("live");
      const prefix = getKeyPrefix(key);

      expect(prefix.startsWith("dk_live_")).toBe(true);
      expect(prefix.length).toBe(12);
    });

    it("extracts prefix from test key", () => {
      const key = generateApiKey("test");
      const prefix = getKeyPrefix(key);

      expect(prefix.startsWith("dk_test_")).toBe(true);
      expect(prefix.length).toBe(12);
    });

    it("produces identifiable but safe prefix", () => {
      const key = "dk_live_secretkey123456789";
      const prefix = getKeyPrefix(key);

      // Prefix should be enough to identify key type
      expect(prefix).toContain("dk_live_");
      // But should not reveal full key
      expect(prefix.length).toBeLessThan(key.length);
    });

    it("handles keys exactly 12 characters", () => {
      const key = "123456789012";
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe("123456789012");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe("integration", () => {
    it("generated key can be hashed and prefixed", () => {
      const key = generateApiKey();
      const hash = hashApiKey(key);
      const prefix = getKeyPrefix(key);

      expect(key.startsWith("dk_live_")).toBe(true);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(prefix.length).toBe(12);
    });

    it("prefix matches start of original key", () => {
      const key = generateApiKey();
      const prefix = getKeyPrefix(key);

      expect(key.startsWith(prefix)).toBe(true);
    });

    it("hash can be used to verify key", () => {
      const key = generateApiKey();
      const storedHash = hashApiKey(key);

      // Later verification
      const providedKey = key;
      const computedHash = hashApiKey(providedKey);

      expect(computedHash).toBe(storedHash);
    });

    it("wrong key fails hash verification", () => {
      const key = generateApiKey();
      const storedHash = hashApiKey(key);

      // Wrong key
      const wrongKey = generateApiKey();
      const wrongHash = hashApiKey(wrongKey);

      expect(wrongHash).not.toBe(storedHash);
    });
  });
});
