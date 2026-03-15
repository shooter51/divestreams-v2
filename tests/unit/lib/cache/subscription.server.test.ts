/**
 * Unit tests for lib/cache/subscription.server.ts
 *
 * Tests for subscription and membership cache invalidation functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the org-context cache module that subscription.server delegates to
// vi.hoisted ensures the variable is available when vi.mock factory runs
// ---------------------------------------------------------------------------

const { mockInvalidateOrgContextCache } = vi.hoisted(() => ({
  mockInvalidateOrgContextCache: vi.fn(),
}));

vi.mock("../../../../lib/cache/org-context.server", () => ({
  invalidateOrgContextCache: mockInvalidateOrgContextCache,
}));

vi.mock("../../../../lib/logger", () => ({
  redisLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  authLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  invalidateSubscriptionCache,
  invalidateSubscriptionCacheBulk,
  invalidateMembershipCache,
} from "../../../../lib/cache/subscription.server";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/cache/subscription.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("invalidateSubscriptionCache", () => {
    it("delegates to invalidateOrgContextCache with the org ID", async () => {
      mockInvalidateOrgContextCache.mockResolvedValue(undefined);
      await invalidateSubscriptionCache("org-123");
      expect(mockInvalidateOrgContextCache).toHaveBeenCalledWith("org-123");
    });

    it("does not throw when invalidation fails", async () => {
      mockInvalidateOrgContextCache.mockRejectedValue(new Error("Redis down"));
      await expect(invalidateSubscriptionCache("org-123")).resolves.not.toThrow();
    });
  });

  describe("invalidateSubscriptionCacheBulk", () => {
    it("invalidates all provided org IDs", async () => {
      mockInvalidateOrgContextCache.mockResolvedValue(undefined);
      await invalidateSubscriptionCacheBulk(["org-A", "org-B", "org-C"]);

      expect(mockInvalidateOrgContextCache).toHaveBeenCalledTimes(3);
      expect(mockInvalidateOrgContextCache).toHaveBeenCalledWith("org-A");
      expect(mockInvalidateOrgContextCache).toHaveBeenCalledWith("org-B");
      expect(mockInvalidateOrgContextCache).toHaveBeenCalledWith("org-C");
    });

    it("handles empty array without calling invalidate", async () => {
      await invalidateSubscriptionCacheBulk([]);
      expect(mockInvalidateOrgContextCache).not.toHaveBeenCalled();
    });

    it("does not throw when one org invalidation fails", async () => {
      mockInvalidateOrgContextCache.mockRejectedValue(new Error("Redis failure"));
      await expect(invalidateSubscriptionCacheBulk(["org-A"])).resolves.not.toThrow();
    });
  });

  describe("invalidateMembershipCache", () => {
    it("delegates to invalidateOrgContextCache with the org ID", async () => {
      mockInvalidateOrgContextCache.mockResolvedValue(undefined);
      await invalidateMembershipCache("org-456");
      expect(mockInvalidateOrgContextCache).toHaveBeenCalledWith("org-456");
    });

    it("does not throw when invalidation fails", async () => {
      mockInvalidateOrgContextCache.mockRejectedValue(new Error("Redis down"));
      await expect(invalidateMembershipCache("org-456")).resolves.not.toThrow();
    });
  });
});
