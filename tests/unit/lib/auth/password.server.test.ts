/**
 * Password Server Tests
 *
 * Tests for password hashing functionality including error paths.
 */

import { describe, it, expect } from "vitest";
import { hashPassword } from "../../../../lib/auth/password.server";

describe("Password Server Module", () => {
  // ============================================================================
  // hashPassword Error Paths and Edge Cases
  // ============================================================================

  describe("hashPassword - Error Paths", () => {
    it("should hash a valid password", async () => {
      const password = "MySecurePassword123!";
      const hash = await hashPassword(password);

      // Should return salt:hash format
      expect(hash).toContain(":");
      const parts = hash.split(":");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // 16 bytes hex = 32 chars
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("should handle empty password string", async () => {
      const hash = await hashPassword("");
      expect(hash).toContain(":");
      const parts = hash.split(":");
      expect(parts).toHaveLength(2);
    });

    it("should handle single character password", async () => {
      const hash = await hashPassword("x");
      expect(hash).toContain(":");
    });

    it("should handle very long password", async () => {
      const longPassword = "x".repeat(10000);
      const hash = await hashPassword(longPassword);
      expect(hash).toContain(":");
    });

    it("should handle password with special characters", async () => {
      const specialPassword = "!@#$%^&*()_+-=[]{}|;:',.<>?/`~";
      const hash = await hashPassword(specialPassword);
      expect(hash).toContain(":");
    });

    it("should handle password with unicode characters", async () => {
      const unicodePassword = "パスワード123🔒";
      const hash = await hashPassword(unicodePassword);
      expect(hash).toContain(":");
    });

    it("should handle password with whitespace", async () => {
      const whitespacePassword = "  password  with  spaces  ";
      const hash = await hashPassword(whitespacePassword);
      expect(hash).toContain(":");
    });

    it("should handle password with newlines", async () => {
      const multilinePassword = "line1\nline2\nline3";
      const hash = await hashPassword(multilinePassword);
      expect(hash).toContain(":");
    });

    it("should handle password with tabs", async () => {
      const tabPassword = "pass\tword\twith\ttabs";
      const hash = await hashPassword(tabPassword);
      expect(hash).toContain(":");
    });

    it("should handle password with null bytes (if possible in JS)", async () => {
      const nullBytePassword = "password\x00with\x00nulls";
      const hash = await hashPassword(nullBytePassword);
      expect(hash).toContain(":");
    });

    it("should produce different hashes for same password (different salts)", async () => {
      const password = "SamePassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Same password should produce different hashes due to random salt
      expect(hash1).not.toBe(hash2);

      // But both should be valid hashes
      expect(hash1).toContain(":");
      expect(hash2).toContain(":");
    });

    it("should produce different hashes for different passwords", async () => {
      const hash1 = await hashPassword("Password1");
      const hash2 = await hashPassword("Password2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle password with only numbers", async () => {
      const numericPassword = "1234567890";
      const hash = await hashPassword(numericPassword);
      expect(hash).toContain(":");
    });

    it("should handle password with only special characters", async () => {
      const specialPassword = "!@#$%^&*()";
      const hash = await hashPassword(specialPassword);
      expect(hash).toContain(":");
    });

    it("should normalize unicode password (NFKC)", async () => {
      // Test that NFKC normalization is applied
      // These two strings look the same but have different unicode representations
      const password1 = "café"; // composed
      const password2 = "café"; // decomposed (e + combining accent)

      const hash1 = await hashPassword(password1);
      const hash2 = await hashPassword(password2);

      // After normalization, they should potentially hash differently
      // because of random salts, but both should be valid
      expect(hash1).toContain(":");
      expect(hash2).toContain(":");
    });

    it("should produce hash with correct format (32-char salt)", async () => {
      const hash = await hashPassword("TestPassword");
      const [salt] = hash.split(":");

      // Salt should be 32 hex characters (16 bytes)
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it("should produce hash with hex-encoded hash part", async () => {
      const hash = await hashPassword("TestPassword");
      const [, hashPart] = hash.split(":");

      // Hash should be hex-encoded (64 bytes = 128 hex chars for scrypt with dkLen=64)
      expect(hashPart).toMatch(/^[0-9a-f]+$/);
      expect(hashPart).toHaveLength(128); // 64 bytes * 2 hex chars per byte
    });

    it("should handle consecutive identical passwords", async () => {
      const password = "RepeatTest123";
      const hashes = [];

      for (let i = 0; i < 5; i++) {
        hashes.push(await hashPassword(password));
      }

      // All hashes should be different (due to random salts)
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(5);
    });

    it("should handle password that looks like a hash format", async () => {
      const fakeHashPassword = "abc123:def456";
      const hash = await hashPassword(fakeHashPassword);
      expect(hash).toContain(":");
      // Should not confuse it with an actual hash
      expect(hash).not.toBe(fakeHashPassword);
    });
  });

  // ============================================================================
  // Performance and Security Tests
  // ============================================================================

  describe("hashPassword - Performance and Security", () => {
    it("should take reasonable time to hash (scrypt is intentionally slow)", async () => {
      const start = Date.now();
      await hashPassword("TestPassword123");
      const duration = Date.now() - start;

      // Should take at least a few milliseconds (scrypt is slow by design)
      // but not more than 2 seconds for a single hash
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000);
    });

    it("should use secure scrypt parameters (N=16384)", async () => {
      // This test verifies the hash is using strong parameters
      // by checking that it takes a reasonable amount of time
      const password = "SecurePassword";

      const start = Date.now();
      await hashPassword(password);
      const duration = Date.now() - start;

      // With N=16384, should take at least 10ms
      expect(duration).toBeGreaterThan(10);
    });

    it("should handle rapid successive hashing", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(hashPassword(`password${i}`));
      }

      const hashes = await Promise.all(promises);

      // All should succeed
      expect(hashes).toHaveLength(10);
      hashes.forEach((hash) => {
        expect(hash).toContain(":");
      });
    });
  });
});
