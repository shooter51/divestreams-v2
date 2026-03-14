/**
 * Unit tests for Zapier integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

describe("Zapier Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getZapierWebhookUrl", () => {
    it("should generate a webhook URL for a given org slug", async () => {
      const { getZapierWebhookUrl } = await import(
        "../../../../lib/integrations/zapier.server"
      );

      const url = getZapierWebhookUrl("my-shop");
      expect(url).toContain("my-shop");
      expect(url).toContain("zapier");
    });
  });

  describe("isValidZapierWebhookUrl", () => {
    it("should return true for a valid HTTPS Zapier URL", async () => {
      const { isValidZapierWebhookUrl } = await import(
        "../../../../lib/integrations/zapier.server"
      );

      expect(isValidZapierWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc")).toBe(true);
    });

    it("should return false for an HTTP URL", async () => {
      const { isValidZapierWebhookUrl } = await import(
        "../../../../lib/integrations/zapier.server"
      );

      expect(isValidZapierWebhookUrl("http://hooks.zapier.com/hooks/catch/123/abc")).toBe(false);
    });

    it("should return false for an empty string", async () => {
      const { isValidZapierWebhookUrl } = await import(
        "../../../../lib/integrations/zapier.server"
      );

      expect(isValidZapierWebhookUrl("")).toBe(false);
    });
  });

  describe("getSampleTriggerData", () => {
    it("should return sample data for booking_created trigger", async () => {
      const { getSampleTriggerData } = await import(
        "../../../../lib/integrations/zapier.server"
      );

      const data = getSampleTriggerData("booking_created");
      expect(data).toBeDefined();
      expect(typeof data).toBe("object");
    });
  });
});
