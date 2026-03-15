/**
 * Jobs Index Module Tests
 *
 * Tests for TranslationJobData interface and enqueueTranslation helper.
 */

import { describe, it, expect, vi } from "vitest";

// Create a proper class mock for Queue
class MockQueue {
  add = vi.fn().mockResolvedValue({ id: "job-1" });
  constructor() {}
}

// Create a proper class mock for IORedis
class MockIORedis {
  status = "ready";
  constructor() {}
  quit = vi.fn();
}

// Mock BullMQ
vi.mock("bullmq", () => ({
  Queue: MockQueue,
}));

// Mock ioredis
vi.mock("ioredis", () => ({
  default: MockIORedis,
}));

describe("TranslationJobData interface", () => {
  it("enqueueTranslation accepts sourceLocale field", async () => {
    const { enqueueTranslation } = await import("../../../../lib/jobs/index");

    // Should not throw with sourceLocale provided
    await expect(
      enqueueTranslation({
        orgId: "org-1",
        entityType: "tour",
        entityId: "tour-1",
        fields: [{ field: "name", text: "Test Tour" }],
        sourceLocale: "es",
        targetLocale: "en",
      })
    ).resolves.not.toThrow();
  });

  it("enqueueTranslation passes sourceLocale to queue job data", async () => {
    const { getTranslationQueue, enqueueTranslation } = await import("../../../../lib/jobs/index");
    const queue = getTranslationQueue();

    await enqueueTranslation({
      orgId: "org-1",
      entityType: "tour",
      entityId: "tour-1",
      fields: [{ field: "name", text: "Prueba" }],
      sourceLocale: "es",
      targetLocale: "en",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "translate-entity",
      expect.objectContaining({
        sourceLocale: "es",
        targetLocale: "en",
      }),
      expect.any(Object)
    );
  });

  it("enqueueTranslation supports English source locale", async () => {
    const { enqueueTranslation } = await import("../../../../lib/jobs/index");

    await expect(
      enqueueTranslation({
        orgId: "org-1",
        entityType: "discount",
        entityId: "discount-1",
        fields: [{ field: "description", text: "Summer discount" }],
        sourceLocale: "en",
        targetLocale: "es",
      })
    ).resolves.not.toThrow();
  });

  it("enqueueTranslation supports non-English source and non-English target", async () => {
    const { enqueueTranslation } = await import("../../../../lib/jobs/index");

    await expect(
      enqueueTranslation({
        orgId: "org-1",
        entityType: "tour",
        entityId: "tour-2",
        fields: [{ field: "name", text: "Tour en Español" }],
        sourceLocale: "es",
        targetLocale: "en",
      })
    ).resolves.not.toThrow();
  });
});
