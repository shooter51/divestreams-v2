/**
 * Rate Limit Utility Tests
 *
 * Tests for Redis-based rate limiting functionality including error paths and edge cases.
 * Mocks the Redis connection to test without a live Redis instance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// In-memory store to simulate Redis keys
let redisStore: Map<string, { value: string; pttl: number; createdAt: number }>;

// Mock multi/exec pipeline results
let multiCommands: Array<{ cmd: string; args: unknown[] }>;

// Flag to simulate Redis being unavailable
let redisThrowOnMulti = false;

const mockPexpire = vi.fn();
const mockDel = vi.fn();

// Mock the logger module to avoid pino initialization issues with fake timers
vi.mock("../../../../lib/logger", () => ({
  redisLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the Redis module before importing rate-limit
vi.mock("../../../../lib/redis.server", () => ({
  getRedisConnection: () => ({
    multi: () => {
      if (redisThrowOnMulti) {
        throw new Error("Redis connection refused");
      }
      multiCommands = [];
      const pipeline = {
        incr: (key: string) => {
          multiCommands.push({ cmd: "incr", args: [key] });
          return pipeline;
        },
        pttl: (key: string) => {
          multiCommands.push({ cmd: "pttl", args: [key] });
          return pipeline;
        },
        exec: async () => {
          const results: Array<[Error | null, unknown]> = [];
          for (const command of multiCommands) {
            if (command.cmd === "incr") {
              const key = command.args[0] as string;
              let existing = redisStore.get(key);
              // Simulate Redis lazy expiry: if key has a TTL and it's expired, delete it
              if (existing && existing.pttl > 0) {
                const elapsed = Date.now() - existing.createdAt;
                if (elapsed >= existing.pttl) {
                  redisStore.delete(key);
                  existing = undefined;
                }
              }
              if (existing) {
                existing.value = String(Number(existing.value) + 1);
                results.push([null, Number(existing.value)]);
              } else {
                redisStore.set(key, { value: "1", pttl: -1, createdAt: Date.now() });
                results.push([null, 1]);
              }
            } else if (command.cmd === "pttl") {
              const key = command.args[0] as string;
              const existing = redisStore.get(key);
              if (!existing || existing.pttl === -1) {
                results.push([null, -1]);
              } else {
                // Calculate remaining TTL
                const elapsed = Date.now() - existing.createdAt;
                const remaining = existing.pttl - elapsed;
                if (remaining <= 0) {
                  // Key expired, remove it
                  redisStore.delete(key);
                  results.push([null, -2]);
                } else {
                  results.push([null, remaining]);
                }
              }
            }
          }
          return results;
        },
      };
      return pipeline;
    },
    pexpire: (key: string, ms: number) => {
      mockPexpire(key, ms);
      const existing = redisStore.get(key);
      if (existing) {
        existing.pttl = ms;
        existing.createdAt = Date.now();
      }
      return Promise.resolve(1);
    },
    del: (key: string) => {
      mockDel(key);
      redisStore.delete(key);
      return Promise.resolve(1);
    },
  }),
}));

import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
} from "../../../../lib/utils/rate-limit";

describe("Rate Limit Module", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    redisStore = new Map();
    multiCommands = [];
    mockPexpire.mockClear();
    mockDel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // checkRateLimit Error Paths and Edge Cases
  // ============================================================================

  describe("checkRateLimit - Error Paths", () => {
    it("should handle empty identifier string", async () => {
      const result = await checkRateLimit("", { maxAttempts: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should handle null identifier (coerced to string)", async () => {
      // @ts-expect-error Testing runtime behavior with null
      const result = await checkRateLimit(null, { maxAttempts: 3, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    });

    it("should handle undefined identifier (coerced to string)", async () => {
      // @ts-expect-error Testing runtime behavior with undefined
      const result = await checkRateLimit(undefined, { maxAttempts: 3, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    });

    it("should handle zero maxAttempts", async () => {
      const result = await checkRateLimit("test-ip", { maxAttempts: 0, windowMs: 60000 });
      // With 0 maxAttempts, count (1) > maxAttempts (0), so blocked
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle negative maxAttempts", async () => {
      const result = await checkRateLimit("test-ip", { maxAttempts: -5, windowMs: 60000 });
      // Should fail immediately with negative limit
      expect(result.allowed).toBe(false);
    });

    it("should handle very small windowMs and expire after minimum TTL", async () => {
      const identifier = "fast-window-test";
      // windowMs: 1 gets rounded up to minimum 1 second TTL in Redis
      const result1 = await checkRateLimit(identifier, { maxAttempts: 5, windowMs: 1 });
      expect(result1.allowed).toBe(true);

      // Advance time past the minimum 1-second TTL used by Redis
      vi.advanceTimersByTime(1001);

      // Key should have expired, so counter resets
      const result2 = await checkRateLimit(identifier, { maxAttempts: 5, windowMs: 1 });
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(4);
    });

    it("should handle very large windowMs", async () => {
      const identifier = "large-window-test";
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const result = await checkRateLimit(identifier, { maxAttempts: 3, windowMs: oneYear });
      expect(result.allowed).toBe(true);
      expect(result.resetAt).toBeGreaterThan(Date.now() + oneYear - 1000);
    });

    it("should handle special characters in identifier", async () => {
      const specialId = "user@email.com:192.168.1.1/api/login";
      const result = await checkRateLimit(specialId, { maxAttempts: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should handle unicode characters in identifier", async () => {
      const unicodeId = "用户@example.com";
      const result = await checkRateLimit(unicodeId, { maxAttempts: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    });

    it("should handle very long identifier strings", async () => {
      const longId = "x".repeat(10000);
      const result = await checkRateLimit(longId, { maxAttempts: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    });

    it("should block exactly at maxAttempts boundary", async () => {
      const identifier = "boundary-test";
      const config = { maxAttempts: 3, windowMs: 60000 };

      // Attempt 1, 2, 3 should succeed
      for (let i = 1; i <= 3; i++) {
        const result = await checkRateLimit(identifier, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3 - i);
      }

      // Attempt 4 should fail
      const result = await checkRateLimit(identifier, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle sequential requests with same identifier", async () => {
      const identifier = "sequential-test";
      const config = { maxAttempts: 5, windowMs: 60000 };

      // Simulate rapid sequential requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await checkRateLimit(identifier, config));
      }

      // First 5 should pass, rest should fail
      expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
      expect(results.slice(5).every((r) => !r.allowed)).toBe(true);
    });

    it("should maintain separate limits for different identifiers", async () => {
      const config = { maxAttempts: 3, windowMs: 60000 };

      // Max out first identifier
      for (let i = 0; i < 3; i++) {
        await checkRateLimit("user1", config);
      }
      const user1Result = await checkRateLimit("user1", config);
      expect(user1Result.allowed).toBe(false);

      // Second identifier should still have full quota
      const user2Result = await checkRateLimit("user2", config);
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(2);
    });

    it("should set pexpire on first request for a key", async () => {
      await checkRateLimit("expire-test", { maxAttempts: 5, windowMs: 60000 });
      // pexpire is called with the windowMs value directly
      expect(mockPexpire).toHaveBeenCalledWith("ratelimit:expire-test", 60000);
    });

    it("should enforce minimum 1 second TTL for very small windowMs", async () => {
      await checkRateLimit("min-ttl-test", { maxAttempts: 5, windowMs: 1 });
      // windowMs of 1 gets clamped to minimum 1000ms
      expect(mockPexpire).toHaveBeenCalledWith("ratelimit:min-ttl-test", 1000);
    });
  });

  // ============================================================================
  // checkRateLimit - Redis Failure (Fail-Open)
  // ============================================================================

  describe("checkRateLimit - Fail-Open on Redis Error", () => {
    it("should allow request when Redis throws an error", async () => {
      redisThrowOnMulti = true;

      const { redisLogger } = await import("../../../../lib/logger");

      const result = await checkRateLimit("fail-open-test", { maxAttempts: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(redisLogger.warn).toHaveBeenCalled();

      // Restore
      redisThrowOnMulti = false;
    });
  });

  // ============================================================================
  // resetRateLimit Error Paths
  // ============================================================================

  describe("resetRateLimit - Error Paths", () => {
    it("should handle resetting non-existent identifier", async () => {
      await expect(resetRateLimit("non-existent")).resolves.not.toThrow();
    });

    it("should handle resetting empty string identifier", async () => {
      await expect(resetRateLimit("")).resolves.not.toThrow();
    });

    it("should handle resetting null identifier", async () => {
      // @ts-expect-error Testing runtime behavior
      await expect(resetRateLimit(null)).resolves.not.toThrow();
    });

    it("should reset and allow new requests after reset", async () => {
      const identifier = "reset-test";
      const config = { maxAttempts: 2, windowMs: 60000 };

      // Use up attempts
      await checkRateLimit(identifier, config);
      await checkRateLimit(identifier, config);

      // Should be blocked
      const blockedResult = await checkRateLimit(identifier, config);
      expect(blockedResult.allowed).toBe(false);

      // Reset
      await resetRateLimit(identifier);

      // Should be allowed again
      const allowedResult = await checkRateLimit(identifier, config);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.remaining).toBe(1);
    });

    it("should call redis.del with the correct key", async () => {
      await resetRateLimit("my-identifier");
      expect(mockDel).toHaveBeenCalledWith("ratelimit:my-identifier");
    });
  });

  // ============================================================================
  // getClientIp Error Paths and Edge Cases
  // ============================================================================

  describe("getClientIp - Error Paths", () => {
    it("should return unknown when no IP headers present", () => {
      const request = new Request("https://example.com/api");
      const ip = getClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should handle x-forwarded-for with single IP", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should handle x-forwarded-for with multiple IPs and use the RIGHTMOST (trusted proxy)", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1" },
      });
      const ip = getClientIp(request);
      // Should return the RIGHTMOST IP (added by trusted proxy)
      expect(ip).toBe("172.16.0.1");
    });

    it("should handle x-forwarded-for with whitespace", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "  192.168.1.1  , 10.0.0.1  " },
      });
      const ip = getClientIp(request);
      // Rightmost IP, trimmed
      expect(ip).toBe("10.0.0.1");
    });

    it("should handle x-real-ip header", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-real-ip": "192.168.1.100" },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.100");
    });

    it("should handle cf-connecting-ip header (Cloudflare)", () => {
      const request = new Request("https://example.com/api", {
        headers: { "cf-connecting-ip": "192.168.1.200" },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.200");
    });

    it("should prioritize cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
      const request = new Request("https://example.com/api", {
        headers: {
          "cf-connecting-ip": "192.168.1.3",
          "x-real-ip": "192.168.1.2",
          "x-forwarded-for": "192.168.1.1",
        },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.3");
    });

    it("should prioritize x-real-ip over x-forwarded-for", () => {
      const request = new Request("https://example.com/api", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
          "x-real-ip": "192.168.1.2",
        },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.2");
    });

    it("should handle empty x-forwarded-for header", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "" },
      });
      const ip = getClientIp(request);
      // Empty string is falsy so falls through to "unknown"
      expect(ip).toBe("unknown");
    });

    it("should handle IPv6 addresses", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should handle invalid IP format gracefully", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "not-an-ip" },
      });
      const ip = getClientIp(request);
      expect(ip).toBe("not-an-ip");
    });

    it("should handle headers with special characters", () => {
      const request = new Request("https://example.com/api", {
        headers: { "x-forwarded-for": "192.168.1.1; malicious-code" },
      });
      const ip = getClientIp(request);
      // Single entry, so rightmost = only entry
      expect(ip).toBe("192.168.1.1; malicious-code");
    });
  });

  // ============================================================================
  // Integration Tests - Realistic Scenarios
  // ============================================================================

  describe("Rate Limit Integration Scenarios", () => {
    it("should handle login rate limiting scenario", async () => {
      const userIp = "192.168.1.100";
      const loginConfig = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }; // 5 attempts per 15 minutes

      // Simulate failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(await checkRateLimit(userIp, loginConfig));
      }

      // First 5 should succeed
      expect(attempts.slice(0, 5).every((a) => a.allowed)).toBe(true);
      // 6th should be blocked
      expect(attempts[5].allowed).toBe(false);
    });

    it("should handle API rate limiting scenario", async () => {
      const apiKey = "api_key_abc123";
      const apiConfig = { maxAttempts: 100, windowMs: 60 * 1000 }; // 100 per minute

      let successCount = 0;
      for (let i = 0; i < 150; i++) {
        const result = await checkRateLimit(apiKey, apiConfig);
        if (result.allowed) successCount++;
      }

      expect(successCount).toBe(100);
    });

    it("should handle distributed rate limiting (different endpoints)", async () => {
      const userIp = "192.168.1.100";

      // Different rate limits for different endpoints
      await checkRateLimit(`${userIp}:login`, { maxAttempts: 5, windowMs: 60000 });
      await checkRateLimit(`${userIp}:api`, { maxAttempts: 100, windowMs: 60000 });
      await checkRateLimit(`${userIp}:register`, { maxAttempts: 3, windowMs: 60000 });

      // Each endpoint should have independent limits
      const loginResult = await checkRateLimit(`${userIp}:login`, { maxAttempts: 5, windowMs: 60000 });
      expect(loginResult.remaining).toBe(3);

      const apiResult = await checkRateLimit(`${userIp}:api`, { maxAttempts: 100, windowMs: 60000 });
      expect(apiResult.remaining).toBe(98);
    });
  });
});
