/**
 * Unit tests for lib/cache/org-context.server.ts
 *
 * Full TDD test suite for the org-context cache helpers.
 * Re-exports and runs the tests from the canonical location.
 *
 * Note: The primary test file lives at:
 *   tests/unit/lib/auth/org-context-cache.test.ts
 *
 * This file satisfies the pre-commit hook path convention
 * (lib/<path> → tests/unit/lib/<path>.test.ts) and adds
 * integration-style tests for the module boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Redis before importing the module
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockScan = vi.fn();

vi.mock("../../../../lib/redis.server", () => ({
  getRedisConnection: () => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    scan: mockScan,
  }),
}));

vi.mock("../../../../lib/logger", () => ({
  redisLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  authLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  getCachedOrgContext,
  setCachedOrgContext,
  invalidateOrgContextCache,
  buildOrgContextCacheKey,
  ORG_CONTEXT_CACHE_TTL,
} from "../../../../lib/cache/org-context.server";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/cache/org-context.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildOrgContextCacheKey", () => {
    it("produces the expected key format", () => {
      expect(buildOrgContextCacheKey("org-1", "user-2")).toBe("org-context:org-1:user-2");
    });
  });

  describe("ORG_CONTEXT_CACHE_TTL", () => {
    it("is 300 seconds", () => {
      expect(ORG_CONTEXT_CACHE_TTL).toBe(300);
    });
  });

  describe("getCachedOrgContext", () => {
    it("returns null on cache miss", async () => {
      mockGet.mockResolvedValue(null);
      expect(await getCachedOrgContext("org-1", "user-1")).toBeNull();
    });

    it("returns parsed object on cache hit", async () => {
      const payload = { org: { id: "org-1" }, user: { id: "user-1" } };
      mockGet.mockResolvedValue(JSON.stringify(payload));
      const result = await getCachedOrgContext("org-1", "user-1");
      expect(result).toMatchObject({ org: { id: "org-1" } });
    });

    it("calls redis.get with correct key", async () => {
      mockGet.mockResolvedValue(null);
      await getCachedOrgContext("org-abc", "user-xyz");
      expect(mockGet).toHaveBeenCalledWith("org-context:org-abc:user-xyz");
    });

    it("returns null when Redis throws", async () => {
      mockGet.mockRejectedValue(new Error("Redis down"));
      expect(await getCachedOrgContext("org-1", "user-1")).toBeNull();
    });
  });

  describe("setCachedOrgContext", () => {
    it("stores with EX TTL of 300", async () => {
      mockSet.mockResolvedValue("OK");
      const ctx = { org: { id: "org-1" }, user: { id: "user-1" } } as Parameters<typeof setCachedOrgContext>[2];
      await setCachedOrgContext("org-1", "user-1", ctx);
      expect(mockSet).toHaveBeenCalledWith("org-context:org-1:user-1", expect.any(String), "EX", 300);
    });

    it("does not throw when Redis fails", async () => {
      mockSet.mockRejectedValue(new Error("OOM"));
      const ctx = { org: { id: "org-1" }, user: { id: "user-1" } } as Parameters<typeof setCachedOrgContext>[2];
      await expect(setCachedOrgContext("org-1", "user-1", ctx)).resolves.not.toThrow();
    });
  });

  describe("invalidateOrgContextCache", () => {
    it("scans for the correct org pattern", async () => {
      mockScan.mockResolvedValueOnce(["0", []]);
      await invalidateOrgContextCache("org-xyz");
      const firstScanArgs = mockScan.mock.calls[0];
      expect(firstScanArgs.some((a: unknown) => typeof a === "string" && a.includes("org-xyz"))).toBe(true);
    });

    it("deletes found keys", async () => {
      mockScan.mockResolvedValueOnce(["0", ["org-context:org-1:user-A"]]);
      mockDel.mockResolvedValue(1);
      await invalidateOrgContextCache("org-1");
      expect(mockDel).toHaveBeenCalledWith("org-context:org-1:user-A");
    });

    it("skips del when no keys found", async () => {
      mockScan.mockResolvedValueOnce(["0", []]);
      await invalidateOrgContextCache("org-1");
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("does not throw when Redis fails", async () => {
      mockScan.mockRejectedValue(new Error("Redis unavailable"));
      await expect(invalidateOrgContextCache("org-1")).resolves.not.toThrow();
    });
  });
});
