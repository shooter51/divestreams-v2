/**
 * Unit tests for QuickBooks sync background jobs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/logger", () => ({
  jobLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../lib/redis.server", () => ({
  getBullMQConnection: vi.fn().mockReturnValue({}),
}));

const mockAdd = vi.fn().mockResolvedValue({ id: "job-1" });
const mockOn = vi.fn();

vi.mock("bullmq", () => {
  class MockQueue {
    add = mockAdd;
  }
  class MockWorker {
    on = mockOn;
    close = vi.fn();
  }
  return { Queue: MockQueue, Worker: MockWorker };
});

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

describe("QuickBooks Sync Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("queueBookingSync", () => {
    it("should add a sync-booking job to the queue", async () => {
      const { queueBookingSync } = await import(
        "../../../../lib/jobs/quickbooks-sync.server"
      );

      await queueBookingSync("org-1", "booking-1");
      expect(mockAdd).toHaveBeenCalledWith(
        "sync-booking",
        expect.objectContaining({ type: "sync-booking", organizationId: "org-1", bookingId: "booking-1" }),
        expect.any(Object)
      );
    });
  });

  describe("queueCustomerSync", () => {
    it("should add a sync-customer job to the queue", async () => {
      const { queueCustomerSync } = await import(
        "../../../../lib/jobs/quickbooks-sync.server"
      );

      const customerData = { name: "John Doe", email: "john@example.com" };
      await queueCustomerSync("org-1", "customer-1", customerData);
      expect(mockAdd).toHaveBeenCalledWith(
        "sync-customer",
        expect.objectContaining({ type: "sync-customer", organizationId: "org-1" }),
        expect.any(Object)
      );
    });
  });

  describe("startQuickBooksSyncWorker", () => {
    it("should create and return a worker with event handlers", async () => {
      const { startQuickBooksSyncWorker } = await import(
        "../../../../lib/jobs/quickbooks-sync.server"
      );

      const worker = startQuickBooksSyncWorker();
      expect(worker).toBeDefined();
      expect(mockOn).toHaveBeenCalledWith("completed", expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith("failed", expect.any(Function));
    });
  });
});
