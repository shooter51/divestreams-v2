/**
 * Unit tests for page-content server functions
 *
 * Tests the initializeDefaultPages function which uses dbLogger for error reporting.
 * See also page-content.test.ts for broader coverage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/logger", () => ({
  dbLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "page-1",
          organizationId: "org-1",
          pageId: "about",
          version: 1,
        }]),
      }),
    }),
  },
}));

describe("Page Content Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initializeDefaultPages", () => {
    it("should create default pages for a new organization", async () => {
      const { initializeDefaultPages } = await import(
        "../../../../lib/db/page-content.server"
      );

      // Should not throw
      await expect(
        initializeDefaultPages("org-1", "Test Shop", "user-1")
      ).resolves.toBeUndefined();
    });

    it("should log errors via dbLogger when page creation fails", async () => {
      // Override insert to reject
      const { db } = await import("../../../../lib/db");
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Duplicate key")),
        }),
      } as ReturnType<typeof db.insert>);

      const { initializeDefaultPages } = await import(
        "../../../../lib/db/page-content.server"
      );
      const { dbLogger } = await import("../../../../lib/logger");

      await initializeDefaultPages("org-1", "Test Shop", "user-1");
      expect(dbLogger.error).toHaveBeenCalled();
    });
  });

  describe("getPageContent", () => {
    it("should return null when page does not exist", async () => {
      const { getPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );

      const result = await getPageContent("org-1", "nonexistent");
      expect(result).toBeNull();
    });
  });
});
