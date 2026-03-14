/**
 * Unit tests for Mailchimp integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("MAILCHIMP_CLIENT_ID", "test-mailchimp-client-id");
vi.stubEnv("MAILCHIMP_CLIENT_SECRET", "test-mailchimp-client-secret");
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

describe("Mailchimp Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMailchimpAuthUrl", () => {
    it("should generate a valid Mailchimp OAuth URL", async () => {
      const { getMailchimpAuthUrl } = await import(
        "../../../../lib/integrations/mailchimp.server"
      );

      const url = getMailchimpAuthUrl("org-123");
      expect(url).toContain("mailchimp.com");
    });

    it("should include client_id in OAuth URL", async () => {
      const { getMailchimpAuthUrl } = await import(
        "../../../../lib/integrations/mailchimp.server"
      );

      const url = getMailchimpAuthUrl("org-123", undefined, "custom-client-id", "secret");
      expect(url).toContain("custom-client-id");
    });
  });

  describe("syncContactsToMailchimp", () => {
    it("should return placeholder sync result", async () => {
      const { syncContactsToMailchimp } = await import(
        "../../../../lib/integrations/mailchimp.server"
      );

      const result = await syncContactsToMailchimp("org-1");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("synced");
    });
  });
});
