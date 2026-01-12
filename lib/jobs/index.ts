/**
 * Job Queue Exports
 *
 * Use these to add jobs to the background queues.
 */

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

// Redis connection (lazy initialization)
let connection: IORedis | null = null;

function getConnection(): ConnectionOptions {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  // Cast to ConnectionOptions to avoid ioredis version conflicts between packages
  return connection as unknown as ConnectionOptions;
}

// Queue names
export const QUEUES = {
  EMAIL: "email",
  BOOKING: "booking",
  REPORT: "report",
  MAINTENANCE: "maintenance",
} as const;

// Lazy queue getters
let _emailQueue: Queue | null = null;
let _bookingQueue: Queue | null = null;
let _reportQueue: Queue | null = null;
let _maintenanceQueue: Queue | null = null;

export function getEmailQueue() {
  if (!_emailQueue) {
    _emailQueue = new Queue(QUEUES.EMAIL, { connection: getConnection() });
  }
  return _emailQueue;
}

export function getBookingQueue() {
  if (!_bookingQueue) {
    _bookingQueue = new Queue(QUEUES.BOOKING, { connection: getConnection() });
  }
  return _bookingQueue;
}

export function getReportQueue() {
  if (!_reportQueue) {
    _reportQueue = new Queue(QUEUES.REPORT, { connection: getConnection() });
  }
  return _reportQueue;
}

export function getMaintenanceQueue() {
  if (!_maintenanceQueue) {
    _maintenanceQueue = new Queue(QUEUES.MAINTENANCE, { connection: getConnection() });
  }
  return _maintenanceQueue;
}

// Helper functions to add jobs

export async function sendEmail(
  type: "booking-confirmation" | "booking-reminder" | "password-reset" | "welcome",
  data: {
    to: string;
    tenantId: string;
    [key: string]: unknown;
  }
) {
  const queue = getEmailQueue();
  await queue.add(type, data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
}

export async function scheduleBookingReminders() {
  const queue = getBookingQueue();
  await queue.add(
    "send-reminders",
    {},
    {
      repeat: {
        pattern: "0 8 * * *", // Every day at 8 AM
      },
    }
  );
}

export async function scheduleMaintenanceChecks() {
  const queue = getMaintenanceQueue();

  // Check equipment service daily
  await queue.add(
    "check-equipment-service",
    {},
    {
      repeat: {
        pattern: "0 6 * * *", // Every day at 6 AM
      },
    }
  );

  // Clean up sessions every hour
  await queue.add(
    "cleanup-expired-sessions",
    {},
    {
      repeat: {
        pattern: "0 * * * *", // Every hour
      },
    }
  );

  // Check trial expirations daily
  await queue.add(
    "check-trial-expirations",
    {},
    {
      repeat: {
        pattern: "0 9 * * *", // Every day at 9 AM
      },
    }
  );
}
