/**
 * Unit tests for QuickBooks integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("QUICKBOOKS_CLIENT_ID", "test-qb-client-id");
vi.stubEnv("QUICKBOOKS_CLIENT_SECRET", "test-qb-client-secret");
vi.stubEnv("APP_URL", "https://divestreams.test");

vi.mock("../../../../lib/logger", () => ({
  integrationLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

describe("QuickBooks Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuickBooksAuthUrl", () => {
    it("should generate a valid QuickBooks OAuth URL", async () => {
      const { getQuickBooksAuthUrl } = await import(
        "../../../../lib/integrations/quickbooks.server"
      );

      const url = getQuickBooksAuthUrl("org-123");
      expect(url).toContain("quickbooks");
    });

    it("should use custom credentials when provided", async () => {
      const { getQuickBooksAuthUrl } = await import(
        "../../../../lib/integrations/quickbooks.server"
      );

      const url = getQuickBooksAuthUrl("org-123", undefined, "custom-client", "secret");
      expect(url).toContain("custom-client");
    });
  });

  describe("getQuickBooksApiBase", () => {
    it("should return sandbox URL when useSandbox is true", async () => {
      const { getQuickBooksApiBase } = await import(
        "../../../../lib/integrations/quickbooks.server"
      );

      const url = getQuickBooksApiBase(true);
      expect(url).toContain("sandbox");
    });

    it("should return production URL by default", async () => {
      const { getQuickBooksApiBase } = await import(
        "../../../../lib/integrations/quickbooks.server"
      );

      const url = getQuickBooksApiBase(false);
      expect(url).not.toContain("sandbox");
    });
  });
});
