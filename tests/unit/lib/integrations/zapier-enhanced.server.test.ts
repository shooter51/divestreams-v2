/**
 * Unit tests for Zapier enhanced integration (REST Hooks and webhook delivery)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/logger", () => ({
  integrationLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../lib/db", () => {
  const insert = vi.fn();
  const values = vi.fn();
  const returning = vi.fn().mockResolvedValue([{ id: "key-1" }]);
  values.mockReturnValue({ returning });
  insert.mockReturnValue({ values });
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    },
  };
});

// Mock BullMQ Queue and Redis
vi.mock("bullmq", () => {
  class MockQueue {
    add = vi.fn().mockResolvedValue({ id: "job-1" });
  }
  return { Queue: MockQueue };
});

vi.mock("ioredis", () => {
  class MockRedis {
    quit = vi.fn();
  }
  return { default: MockRedis };
});

describe("Zapier Enhanced Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateZapierApiKey", () => {
    it("should generate a key with the correct prefix format", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "key-1" }]);
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) });

      vi.doMock("../../../../lib/db", () => ({
        db: { insert: mockInsert },
      }));

      const { generateZapierApiKey } = await import(
        "../../../../lib/integrations/zapier-enhanced.server"
      );

      const result = await generateZapierApiKey("org-123");
      expect(result.key).toMatch(/^zap_dev_/);
      expect(result.keyId).toBeDefined();
    });
  });

  describe("generateZapierApiKey", () => {
    it("should generate a key with the zap_dev_ prefix", async () => {
      const { generateZapierApiKey } = await import(
        "../../../../lib/integrations/zapier-enhanced.server"
      );

      const result = await generateZapierApiKey("org-123");
      expect(result.key).toMatch(/^zap_dev_[0-9a-f]{48}$/);
      expect(result.keyId).toBeDefined();
    });
  });
});
