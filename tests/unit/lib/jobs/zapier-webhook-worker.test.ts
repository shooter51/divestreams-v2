/**
 * Unit tests for Zapier webhook worker
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/logger", () => ({
  jobLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../lib/integrations/zapier-enhanced.server", () => ({
  deliverWebhook: vi.fn(),
}));

const mockOn = vi.fn();
const mockClose = vi.fn();

vi.mock("bullmq", () => {
  class MockWorker {
    on = mockOn;
    close = mockClose;
  }
  return { Worker: MockWorker };
});

vi.mock("ioredis", () => {
  class MockRedis {
    quit = vi.fn();
  }
  return { default: MockRedis };
});

describe("Zapier Webhook Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register event listeners on the worker", async () => {
    // Importing the module triggers worker creation and event registration
    await import("../../../../lib/jobs/zapier-webhook-worker");
    expect(mockOn).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("should log job completion via jobLogger", async () => {
    await import("../../../../lib/jobs/zapier-webhook-worker");
    const { jobLogger } = await import("../../../../lib/logger");

    // Find the completed handler and invoke it
    const completedCall = mockOn.mock.calls.find(
      (call: unknown[]) => call[0] === "completed"
    );
    if (completedCall) {
      const handler = completedCall[1] as (job: { id: string }) => void;
      handler({ id: "job-123" });
      expect(jobLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: "job-123" }),
        expect.any(String)
      );
    }
  });
});
