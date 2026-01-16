/**
 * Background Job Worker Tests
 *
 * Tests for the job worker configuration and exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Track created workers for testing
const createdWorkers: MockWorker[] = [];
let mockProcessExit: ReturnType<typeof vi.spyOn>;

// Create proper class mocks for BullMQ
class MockQueue {
  name: string;
  add = vi.fn().mockResolvedValue({ id: "job-1" });
  constructor(name: string, _opts: any) {
    this.name = name;
  }
}

class MockWorker {
  name: string;
  opts: any;
  processor: (job: any) => Promise<void>;
  eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  constructor(name: string, processor: (job: any) => Promise<void>, opts: any) {
    this.name = name;
    this.processor = processor;
    this.opts = opts;
    createdWorkers.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    return this;
  }

  close = vi.fn().mockResolvedValue(undefined);

  // Helper to simulate job processing
  async simulateJob(job: { name: string; data: any; id: string }) {
    return this.processor(job);
  }

  // Helper to emit events
  emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers[event] || [];
    handlers.forEach(handler => handler(...args));
  }
}

// Create proper class mock for IORedis
class MockIORedis {
  status = "ready";
  url: string;

  constructor(url: string, _opts?: any) {
    this.url = url;
  }

  quit = vi.fn().mockResolvedValue(undefined);
}

// Mock BullMQ
vi.mock("bullmq", () => ({
  Queue: MockQueue,
  Worker: MockWorker,
}));

// Mock ioredis
vi.mock("ioredis", () => ({
  default: MockIORedis,
}));

// Create mock functions for email
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockBookingConfirmationEmail = vi.fn().mockReturnValue({
  subject: "Booking Confirmed",
  html: "<p>Test</p>",
  text: "Test",
});
const mockBookingReminderEmail = vi.fn().mockReturnValue({
  subject: "Reminder",
  html: "<p>Reminder</p>",
  text: "Reminder",
});
const mockPasswordResetEmail = vi.fn().mockReturnValue({
  subject: "Reset Password",
  html: "<p>Reset</p>",
  text: "Reset",
});
const mockWelcomeEmail = vi.fn().mockReturnValue({
  subject: "Welcome",
  html: "<p>Welcome</p>",
  text: "Welcome",
});

// Mock email module
vi.mock("../../../../lib/email", () => ({
  sendEmail: mockSendEmail,
  bookingConfirmationEmail: mockBookingConfirmationEmail,
  bookingReminderEmail: mockBookingReminderEmail,
  passwordResetEmail: mockPasswordResetEmail,
  welcomeEmail: mockWelcomeEmail,
}));

// Create mock for stale tenant cleanup
const mockCleanupStaleTenants = vi.fn().mockResolvedValue({
  processed: 5,
  firstWarningsSent: 2,
  secondWarningsSent: 1,
  softDeleted: 1,
  errors: [],
});

// Mock stale tenant cleanup
vi.mock("../../../../lib/jobs/stale-tenant-cleanup", () => ({
  cleanupStaleTenants: mockCleanupStaleTenants,
}));

// Create chainable mock for database queries
// The mock needs to return arrays when awaited after the .from() call
const createDbMock = () => {
  // Track call count to differentiate between organization query and booking queries
  let selectCallCount = 0;

  const createChain = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: (resolve: (v: unknown[]) => void) => void } = {};

    // Make the chain thenable (awaitable) - returns empty array by default
    chain.then = (resolve: (v: unknown[]) => void) => {
      resolve([]);
      return Promise.resolve([]);
    };

    const methods = ['from', 'innerJoin', 'leftJoin', 'rightJoin', 'where', 'orderBy', 'limit'];
    methods.forEach(method => {
      chain[method] = vi.fn().mockReturnValue(chain);
    });

    return chain;
  };

  return {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      return createChain();
    }),
  };
};

const mockDb = createDbMock();

// Mock database module
vi.mock("../../../../lib/db", () => ({
  db: mockDb,
}));

// Mock schema modules
vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: { id: "id", name: "name", slug: "slug" },
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: { id: "id", tripId: "tripId", customerId: "customerId", organizationId: "organizationId", status: "status", bookingNumber: "bookingNumber" },
  trips: { id: "id", tourId: "tourId", date: "date", startTime: "startTime" },
  tours: { id: "id", name: "name" },
  customers: { id: "id", email: "email", firstName: "firstName", lastName: "lastName" },
}));

describe("Job Worker Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdWorkers.length = 0;
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
  });

  describe("Module exports", () => {
    it("exports QUEUES constant", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(workerModule.QUEUES).toBeDefined();
    });

    it("exports emailQueue", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(workerModule.emailQueue).toBeDefined();
    });

    it("exports bookingQueue", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(workerModule.bookingQueue).toBeDefined();
    });

    it("exports reportQueue", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(workerModule.reportQueue).toBeDefined();
    });

    it("exports maintenanceQueue", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(workerModule.maintenanceQueue).toBeDefined();
    });

    it("exports startWorkers function", async () => {
      const workerModule = await import("../../../../lib/jobs/worker");
      expect(typeof workerModule.startWorkers).toBe("function");
    });
  });

  describe("QUEUES constant", () => {
    it("defines EMAIL queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/worker");
      expect(QUEUES.EMAIL).toBe("email");
    });

    it("defines BOOKING queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/worker");
      expect(QUEUES.BOOKING).toBe("booking");
    });

    it("defines REPORT queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/worker");
      expect(QUEUES.REPORT).toBe("report");
    });

    it("defines MAINTENANCE queue name", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/worker");
      expect(QUEUES.MAINTENANCE).toBe("maintenance");
    });

    it("has exactly 4 queue types", async () => {
      const { QUEUES } = await import("../../../../lib/jobs/worker");
      expect(Object.keys(QUEUES)).toHaveLength(4);
    });
  });

  describe("Queue instances", () => {
    it("emailQueue has add method", async () => {
      const { emailQueue } = await import("../../../../lib/jobs/worker");
      expect(typeof emailQueue.add).toBe("function");
    });

    it("bookingQueue has add method", async () => {
      const { bookingQueue } = await import("../../../../lib/jobs/worker");
      expect(typeof bookingQueue.add).toBe("function");
    });

    it("reportQueue has add method", async () => {
      const { reportQueue } = await import("../../../../lib/jobs/worker");
      expect(typeof reportQueue.add).toBe("function");
    });

    it("maintenanceQueue has add method", async () => {
      const { maintenanceQueue } = await import("../../../../lib/jobs/worker");
      expect(typeof maintenanceQueue.add).toBe("function");
    });
  });

  describe("Queue names match QUEUES constant", () => {
    it("emailQueue uses EMAIL queue name", async () => {
      const { emailQueue, QUEUES } = await import("../../../../lib/jobs/worker");
      expect(emailQueue.name).toBe(QUEUES.EMAIL);
    });

    it("bookingQueue uses BOOKING queue name", async () => {
      const { bookingQueue, QUEUES } = await import("../../../../lib/jobs/worker");
      expect(bookingQueue.name).toBe(QUEUES.BOOKING);
    });

    it("reportQueue uses REPORT queue name", async () => {
      const { reportQueue, QUEUES } = await import("../../../../lib/jobs/worker");
      expect(reportQueue.name).toBe(QUEUES.REPORT);
    });

    it("maintenanceQueue uses MAINTENANCE queue name", async () => {
      const { maintenanceQueue, QUEUES } = await import("../../../../lib/jobs/worker");
      expect(maintenanceQueue.name).toBe(QUEUES.MAINTENANCE);
    });
  });

  describe("startWorkers function", () => {
    it("creates email worker with concurrency 5", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);
      expect(emailWorker).toBeDefined();
      expect(emailWorker?.opts.concurrency).toBe(5);
    });

    it("creates booking worker with concurrency 3", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);
      expect(bookingWorker).toBeDefined();
      expect(bookingWorker?.opts.concurrency).toBe(3);
    });

    it("creates report worker with concurrency 1", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);
      expect(reportWorker).toBeDefined();
      expect(reportWorker?.opts.concurrency).toBe(1);
    });

    it("creates maintenance worker with concurrency 2", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);
      expect(maintenanceWorker).toBeDefined();
      expect(maintenanceWorker?.opts.concurrency).toBe(2);
    });

    it("registers event handlers for all workers", async () => {
      const { startWorkers } = await import("../../../../lib/jobs/worker");
      startWorkers();

      createdWorkers.forEach(worker => {
        expect(worker.eventHandlers["completed"]).toBeDefined();
        expect(worker.eventHandlers["failed"]).toBeDefined();
      });
    });
  });

  describe("Email job processor", () => {
    it("processes booking-confirmation job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);
      expect(emailWorker).toBeDefined();

      await emailWorker!.simulateJob({
        name: "booking-confirmation",
        id: "job-1",
        data: {
          to: "customer@example.com",
          customerName: "John Doe",
          tripName: "Morning Dive",
          tripDate: "2024-01-15",
          tripTime: "09:00",
          participants: 2,
          total: "$198.00",
          bookingNumber: "BK-123",
          shopName: "Ocean Dive Shop",
        },
      });

      expect(mockBookingConfirmationEmail).toHaveBeenCalledWith({
        customerName: "John Doe",
        tripName: "Morning Dive",
        tripDate: "2024-01-15",
        tripTime: "09:00",
        participants: 2,
        total: "$198.00",
        bookingNumber: "BK-123",
        shopName: "Ocean Dive Shop",
      });
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: "customer@example.com",
        subject: "Booking Confirmed",
        html: "<p>Test</p>",
        text: "Test",
      });
    });

    it("processes booking-reminder job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);

      await emailWorker!.simulateJob({
        name: "booking-reminder",
        id: "job-2",
        data: {
          to: "customer@example.com",
          customerName: "Jane Smith",
          tripName: "Sunset Dive",
          tripDate: "2024-01-20",
          tripTime: "16:00",
          bookingNumber: "BK-456",
          shopName: "Reef Explorers",
        },
      });

      expect(mockBookingReminderEmail).toHaveBeenCalledWith({
        customerName: "Jane Smith",
        tripName: "Sunset Dive",
        tripDate: "2024-01-20",
        tripTime: "16:00",
        bookingNumber: "BK-456",
        shopName: "Reef Explorers",
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("processes password-reset job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);

      await emailWorker!.simulateJob({
        name: "password-reset",
        id: "job-3",
        data: {
          to: "user@example.com",
          userName: "Bob Wilson",
          resetUrl: "https://app.divestreams.com/reset?token=abc123",
        },
      });

      expect(mockPasswordResetEmail).toHaveBeenCalledWith({
        userName: "Bob Wilson",
        resetUrl: "https://app.divestreams.com/reset?token=abc123",
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("processes welcome job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);

      await emailWorker!.simulateJob({
        name: "welcome",
        id: "job-4",
        data: {
          to: "newuser@example.com",
          userName: "Alice Brown",
          shopName: "Deep Blue Diving",
          loginUrl: "https://deepblue.divestreams.com/login",
        },
      });

      expect(mockWelcomeEmail).toHaveBeenCalledWith({
        userName: "Alice Brown",
        shopName: "Deep Blue Diving",
        loginUrl: "https://deepblue.divestreams.com/login",
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("handles unknown email job types gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);

      await emailWorker!.simulateJob({
        name: "unknown-email-type",
        id: "job-5",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith("Unknown email job: unknown-email-type");
      consoleSpy.mockRestore();
    });
  });

  describe("Booking job processor", () => {
    it("processes send-reminders job", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);

      await bookingWorker!.simulateJob({
        name: "send-reminders",
        id: "job-6",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("send-reminders"));
      consoleSpy.mockRestore();
    });

    it("processes mark-no-shows job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);

      // Should complete without error
      await expect(bookingWorker!.simulateJob({
        name: "mark-no-shows",
        id: "job-7",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes update-customer-stats job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);

      // Should complete without error
      await expect(bookingWorker!.simulateJob({
        name: "update-customer-stats",
        id: "job-8",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("handles unknown booking job types gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);

      await bookingWorker!.simulateJob({
        name: "unknown-booking-type",
        id: "job-9",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith("Unknown booking job: unknown-booking-type");
      consoleSpy.mockRestore();
    });
  });

  describe("Report job processor", () => {
    it("processes generate-daily job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);

      await expect(reportWorker!.simulateJob({
        name: "generate-daily",
        id: "job-10",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes generate-weekly job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);

      await expect(reportWorker!.simulateJob({
        name: "generate-weekly",
        id: "job-11",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes generate-monthly job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);

      await expect(reportWorker!.simulateJob({
        name: "generate-monthly",
        id: "job-12",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("handles unknown report job types gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);

      await reportWorker!.simulateJob({
        name: "unknown-report-type",
        id: "job-13",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith("Unknown report job: unknown-report-type");
      consoleSpy.mockRestore();
    });
  });

  describe("Maintenance job processor", () => {
    it("processes check-equipment-service job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);

      await expect(maintenanceWorker!.simulateJob({
        name: "check-equipment-service",
        id: "job-14",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes cleanup-expired-sessions job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);

      await expect(maintenanceWorker!.simulateJob({
        name: "cleanup-expired-sessions",
        id: "job-15",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes check-trial-expirations job", async () => {
      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);

      await expect(maintenanceWorker!.simulateJob({
        name: "check-trial-expirations",
        id: "job-16",
        data: {},
      })).resolves.toBeUndefined();
    });

    it("processes cleanup-stale-tenants job and calls cleanupStaleTenants", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);

      await maintenanceWorker!.simulateJob({
        name: "cleanup-stale-tenants",
        id: "job-17",
        data: {},
      });

      expect(mockCleanupStaleTenants).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[cleanup-stale-tenants] Results:",
        expect.objectContaining({
          processed: 5,
          firstWarningsSent: 2,
          secondWarningsSent: 1,
          softDeleted: 1,
        })
      );
      consoleSpy.mockRestore();
    });

    it("handles unknown maintenance job types gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);

      await maintenanceWorker!.simulateJob({
        name: "unknown-maintenance-type",
        id: "job-18",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith("Unknown maintenance job: unknown-maintenance-type");
      consoleSpy.mockRestore();
    });
  });

  describe("Worker event handlers", () => {
    it("logs on job completion", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);
      emailWorker!.emit("completed", { id: "test-job-1" });

      expect(consoleSpy).toHaveBeenCalledWith("Email job test-job-1 completed");
      consoleSpy.mockRestore();
    });

    it("logs error on job failure", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);
      const testError = new Error("Test error");
      emailWorker!.emit("failed", { id: "test-job-2" }, testError);

      expect(consoleSpy).toHaveBeenCalledWith("Email job test-job-2 failed:", testError);
      consoleSpy.mockRestore();
    });

    it("logs completion for all worker types", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const bookingWorker = createdWorkers.find(w => w.name === QUEUES.BOOKING);
      bookingWorker!.emit("completed", { id: "booking-job-1" });
      expect(consoleSpy).toHaveBeenCalledWith("Booking job booking-job-1 completed");

      const reportWorker = createdWorkers.find(w => w.name === QUEUES.REPORT);
      reportWorker!.emit("completed", { id: "report-job-1" });
      expect(consoleSpy).toHaveBeenCalledWith("Report job report-job-1 completed");

      const maintenanceWorker = createdWorkers.find(w => w.name === QUEUES.MAINTENANCE);
      maintenanceWorker!.emit("completed", { id: "maintenance-job-1" });
      expect(consoleSpy).toHaveBeenCalledWith("Maintenance job maintenance-job-1 completed");

      consoleSpy.mockRestore();
    });

    it("handles failed job with undefined job id", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { startWorkers, QUEUES } = await import("../../../../lib/jobs/worker");
      startWorkers();

      const emailWorker = createdWorkers.find(w => w.name === QUEUES.EMAIL);
      const testError = new Error("Test error");
      emailWorker!.emit("failed", undefined, testError);

      expect(consoleSpy).toHaveBeenCalledWith("Email job undefined failed:", testError);
      consoleSpy.mockRestore();
    });
  });
});
