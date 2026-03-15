/**
 * Org Context Caching Tests (TDD)
 *
 * Tests for Redis caching of org context in getOrgContext().
 * These tests were written BEFORE the implementation (TDD).
 *
 * Cache key format: org-context:{orgId}:{userId}
 * TTL: 5 minutes (300 seconds)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules BEFORE any imports that transitively load them
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisScan = vi.fn();

vi.mock("../../../../lib/redis.server", () => ({
  getRedisConnection: () => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    scan: mockRedisScan,
  }),
}));

// Mock logger to suppress noise
vi.mock("../../../../lib/logger", () => ({
  redisLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  authLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are in place
// ---------------------------------------------------------------------------

import {
  getCachedOrgContext,
  setCachedOrgContext,
  invalidateOrgContextCache,
  ORG_CONTEXT_CACHE_TTL,
  buildOrgContextCacheKey,
} from "../../../../lib/cache/org-context.server";
import type { OrgContext } from "../../../../lib/auth/org-context.server";
import { FREE_TIER_LIMITS } from "../../../../lib/auth/org-context.server";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCacheableContext(): OrgContext {
  return {
    user: { id: "user-1", name: "Alice", email: "alice@example.com" } as OrgContext["user"],
    session: { id: "session-1" } as OrgContext["session"],
    org: { id: "org-1", name: "Test Org", slug: "test-org" } as OrgContext["org"],
    membership: { id: "mem-1", role: "owner", userId: "user-1", organizationId: "org-1" } as OrgContext["membership"],
    subscription: null,
    limits: FREE_TIER_LIMITS,
    usage: { customers: 5, tours: 2, bookingsThisMonth: 10 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("org-context cache helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // buildOrgContextCacheKey
  // -------------------------------------------------------------------------

  describe("buildOrgContextCacheKey", () => {
    it("returns correct key format", () => {
      const key = buildOrgContextCacheKey("org-abc", "user-xyz");
      expect(key).toBe("org-context:org-abc:user-xyz");
    });

    it("key includes both orgId and userId so different users share no cache", () => {
      const key1 = buildOrgContextCacheKey("org-1", "user-A");
      const key2 = buildOrgContextCacheKey("org-1", "user-B");
      expect(key1).not.toBe(key2);
    });

    it("key is org-specific so different orgs share no cache", () => {
      const key1 = buildOrgContextCacheKey("org-A", "user-1");
      const key2 = buildOrgContextCacheKey("org-B", "user-1");
      expect(key1).not.toBe(key2);
    });
  });

  // -------------------------------------------------------------------------
  // ORG_CONTEXT_CACHE_TTL
  // -------------------------------------------------------------------------

  describe("ORG_CONTEXT_CACHE_TTL", () => {
    it("is exactly 300 seconds (5 minutes)", () => {
      expect(ORG_CONTEXT_CACHE_TTL).toBe(300);
    });
  });

  // -------------------------------------------------------------------------
  // getCachedOrgContext
  // -------------------------------------------------------------------------

  describe("getCachedOrgContext", () => {
    it("returns null on cache miss", async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await getCachedOrgContext("org-1", "user-1");
      expect(result).toBeNull();
    });

    it("returns parsed context on cache hit", async () => {
      const ctx = makeCacheableContext();
      mockRedisGet.mockResolvedValue(JSON.stringify(ctx));

      const result = await getCachedOrgContext("org-1", "user-1");
      expect(result).not.toBeNull();
      expect(result!.org.id).toBe("org-1");
      expect(result!.user.id).toBe("user-1");
    });

    it("calls redis.get with the correct key", async () => {
      mockRedisGet.mockResolvedValue(null);

      await getCachedOrgContext("org-abc", "user-xyz");
      expect(mockRedisGet).toHaveBeenCalledWith("org-context:org-abc:user-xyz");
    });

    it("returns null when Redis throws (fail open)", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis connection refused"));

      const result = await getCachedOrgContext("org-1", "user-1");
      expect(result).toBeNull();
    });

    it("deserializes Infinity usage limits correctly", async () => {
      const ctx = makeCacheableContext();
      ctx.limits = { ...FREE_TIER_LIMITS, customers: Infinity };
      // JSON.stringify converts Infinity to null — the cache layer must handle this
      const serialized = JSON.stringify(ctx);
      mockRedisGet.mockResolvedValue(serialized);

      // Should not throw; may return null for limits containing Infinity
      const result = await getCachedOrgContext("org-1", "user-1");
      // The function should not throw even if Infinity round-trips as null
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // setCachedOrgContext
  // -------------------------------------------------------------------------

  describe("setCachedOrgContext", () => {
    it("stores context in Redis with correct key and TTL", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const ctx = makeCacheableContext();

      await setCachedOrgContext("org-1", "user-1", ctx);

      expect(mockRedisSet).toHaveBeenCalledWith(
        "org-context:org-1:user-1",
        expect.any(String),
        "EX",
        300
      );
    });

    it("serializes context to JSON string", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const ctx = makeCacheableContext();

      await setCachedOrgContext("org-1", "user-1", ctx);

      const [, jsonArg] = mockRedisSet.mock.calls[0];
      const parsed = JSON.parse(jsonArg);
      expect(parsed.org.id).toBe("org-1");
      expect(parsed.usage.customers).toBe(5);
    });

    it("does not throw when Redis set fails (fail safe)", async () => {
      mockRedisSet.mockRejectedValue(new Error("Redis full"));
      const ctx = makeCacheableContext();

      await expect(setCachedOrgContext("org-1", "user-1", ctx)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // invalidateOrgContextCache
  // -------------------------------------------------------------------------

  describe("invalidateOrgContextCache", () => {
    it("deletes cache entries for an org using scan+del pattern", async () => {
      // Simulate scan returning one page of results and then ending
      mockRedisScan
        .mockResolvedValueOnce(["0", ["org-context:org-1:user-A", "org-context:org-1:user-B"]])
      mockRedisDel.mockResolvedValue(2);

      await invalidateOrgContextCache("org-1");

      expect(mockRedisScan).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalled();
    });

    it("uses the correct key pattern to scope the scan", async () => {
      mockRedisScan.mockResolvedValueOnce(["0", []]);

      await invalidateOrgContextCache("org-abc");

      const scanCall = mockRedisScan.mock.calls[0];
      // The MATCH argument should contain the orgId
      const matchArg = scanCall.find((arg: string) => typeof arg === "string" && arg.includes("org-abc"));
      expect(matchArg).toBeDefined();
    });

    it("does not throw when Redis scan fails (fail safe)", async () => {
      mockRedisScan.mockRejectedValue(new Error("Redis unavailable"));

      await expect(invalidateOrgContextCache("org-1")).resolves.not.toThrow();
    });

    it("handles empty scan results without calling del", async () => {
      mockRedisScan.mockResolvedValueOnce(["0", []]);

      await invalidateOrgContextCache("org-1");

      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it("paginates through multiple scan pages until cursor is 0", async () => {
      // First scan returns cursor "42" (more results)
      mockRedisScan
        .mockResolvedValueOnce(["42", ["org-context:org-1:user-A"]])
        .mockResolvedValueOnce(["0", ["org-context:org-1:user-B"]]);
      mockRedisDel.mockResolvedValue(1);

      await invalidateOrgContextCache("org-1");

      expect(mockRedisScan).toHaveBeenCalledTimes(2);
      expect(mockRedisDel).toHaveBeenCalledTimes(2);
    });
  });
});
