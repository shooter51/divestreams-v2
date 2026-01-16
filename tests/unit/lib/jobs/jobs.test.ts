/**
 * Jobs Module Tests
 *
 * Tests for job queue constants.
 * Note: Queue functionality requires Redis and BullMQ mocking which is complex.
 * Those tests should be handled in integration tests.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

// Create a proper class mock for Queue
class MockQueue {
  add = vi.fn().mockResolvedValue({ id: "job-1" });
  constructor(_name: string, _opts: any) {}
}

// Create a proper class mock for IORedis
class MockIORedis {
  status = "ready";
  constructor(_url: string, _opts?: any) {}
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

describe("Jobs Module", () => {
  describe("QUEUES constant", () => {
    it("defines EMAIL queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      expect(QUEUES.EMAIL).toBe("email");
    });

    it("defines BOOKING queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      expect(QUEUES.BOOKING).toBe("booking");
    });

    it("defines REPORT queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      expect(QUEUES.REPORT).toBe("report");
    });

    it("defines MAINTENANCE queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      expect(QUEUES.MAINTENANCE).toBe("maintenance");
    });

    it("has exactly 4 queue types", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      expect(Object.keys(QUEUES)).toHaveLength(4);
    });

    it("all queue names are lowercase strings", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/index");
      Object.values(QUEUES).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value).toBe(value.toLowerCase());
      });
    });
  });

  describe("Module exports", () => {
    it("exports getEmailQueue function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.getEmailQueue).toBe("function");
    });

    it("exports getBookingQueue function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.getBookingQueue).toBe("function");
    });

    it("exports getReportQueue function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.getReportQueue).toBe("function");
    });

    it("exports getMaintenanceQueue function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.getMaintenanceQueue).toBe("function");
    });

    it("exports sendEmail function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.sendEmail).toBe("function");
    });

    it("exports scheduleBookingReminders function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.scheduleBookingReminders).toBe("function");
    });

    it("exports scheduleMaintenanceChecks function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.scheduleMaintenanceChecks).toBe("function");
    });

    it("exports cleanupStaleTenants function", async () => {
      const jobs = await import("../../../../lib/jobs/index");
      expect(typeof jobs.cleanupStaleTenants).toBe("function");
    });
  });

  describe("Queue getters", () => {
    it("getEmailQueue returns object with add method", async () => {
      const { getEmailQueue } = await import("../../../../lib/jobs/index");
      const queue = getEmailQueue();
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty("add");
    });

    it("getBookingQueue returns object with add method", async () => {
      const { getBookingQueue } = await import("../../../../lib/jobs/index");
      const queue = getBookingQueue();
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty("add");
    });

    it("getReportQueue returns object with add method", async () => {
      const { getReportQueue } = await import("../../../../lib/jobs/index");
      const queue = getReportQueue();
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty("add");
    });

    it("getMaintenanceQueue returns object with add method", async () => {
      const { getMaintenanceQueue } = await import("../../../../lib/jobs/index");
      const queue = getMaintenanceQueue();
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty("add");
    });
  });

  describe("sendEmail function", () => {
    it("returns a promise", async () => {
      const { sendEmail } = await import("../../../../lib/jobs/index");
      const result = sendEmail("booking-confirmation", {
        to: "test@example.com",
        tenantId: "t1",
      });
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe("scheduleBookingReminders function", () => {
    it("returns a promise", async () => {
      const { scheduleBookingReminders } = await import("../../../../lib/jobs/index");
      const result = scheduleBookingReminders();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe("scheduleMaintenanceChecks function", () => {
    it("returns a promise", async () => {
      const { scheduleMaintenanceChecks } = await import("../../../../lib/jobs/index");
      const result = scheduleMaintenanceChecks();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });
});
