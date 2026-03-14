/**
 * Unit tests for Xero integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("XERO_CLIENT_ID", "test-xero-client-id");
vi.stubEnv("XERO_CLIENT_SECRET", "test-xero-client-secret");
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

describe("Xero Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getXeroAuthUrl", () => {
    it("should generate a valid Xero OAuth URL", async () => {
      const { getXeroAuthUrl } = await import(
        "../../../../lib/integrations/xero.server"
      );

      const url = getXeroAuthUrl("org-123");
      expect(url).toContain("xero.com");
    });

    it("should use custom client credentials when provided", async () => {
      const { getXeroAuthUrl } = await import(
        "../../../../lib/integrations/xero.server"
      );

      const url = getXeroAuthUrl("org-123", undefined, "my-client-id", "my-secret");
      expect(url).toContain("my-client-id");
    });
  });

  describe("parseOAuthState", () => {
    it("should throw on an invalid state string", async () => {
      const { parseOAuthState } = await import(
        "../../../../lib/integrations/xero.server"
      );

      expect(() => parseOAuthState("invalid-state")).toThrow();
    });
  });
});
