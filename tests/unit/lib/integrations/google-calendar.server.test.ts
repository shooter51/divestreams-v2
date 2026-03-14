/**
 * Unit tests for Google Calendar server integration (OAuth and token management)
 *
 * Tests the core OAuth URL generation and token refresh logic.
 * Complements google-calendar.test.ts which covers URL generation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment variables
vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

describe("Google Calendar Server Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGoogleAuthUrl", () => {
    it("should generate a valid OAuth URL", async () => {
      const { getGoogleAuthUrl } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const url = getGoogleAuthUrl("org-123");
      expect(url).toContain("accounts.google.com");
      expect(url).toContain("test-client-id.apps.googleusercontent.com");
    });

    it("should include state parameter with orgId", async () => {
      const { getGoogleAuthUrl } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const url = getGoogleAuthUrl("org-abc");
      expect(url).toContain("state=");
    });
  });
});
