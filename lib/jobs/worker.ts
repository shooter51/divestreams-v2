#!/usr/bin/env tsx
/**
 * Background Job Worker
 *
 * Processes queued jobs using BullMQ and Redis.
 *
 * Usage:
 *   npm run worker
 */

import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUES = {
  EMAIL: "email",
  BOOKING: "booking",
  REPORT: "report",
  MAINTENANCE: "maintenance",
} as const;

// Create queues
export const emailQueue = new Queue(QUEUES.EMAIL, { connection });
export const bookingQueue = new Queue(QUEUES.BOOKING, { connection });
export const reportQueue = new Queue(QUEUES.REPORT, { connection });
export const maintenanceQueue = new Queue(QUEUES.MAINTENANCE, { connection });

// Job handlers
async function processEmailJob(job: { name: string; data: unknown }) {
  console.log(`Processing email job: ${job.name}`, job.data);
  // TODO: Implement email sending
  switch (job.name) {
    case "booking-confirmation":
      // Send booking confirmation email
      break;
    case "booking-reminder":
      // Send booking reminder email
      break;
    case "password-reset":
      // Send password reset email
      break;
    case "welcome":
      // Send welcome email
      break;
    default:
      console.warn(`Unknown email job: ${job.name}`);
  }
}

async function processBookingJob(job: { name: string; data: unknown }) {
  console.log(`Processing booking job: ${job.name}`, job.data);
  switch (job.name) {
    case "send-reminders":
      // Find bookings happening tomorrow and send reminders
      break;
    case "mark-no-shows":
      // Mark no-shows for trips that have completed
      break;
    case "update-customer-stats":
      // Update customer dive counts and spending
      break;
    default:
      console.warn(`Unknown booking job: ${job.name}`);
  }
}

async function processReportJob(job: { name: string; data: unknown }) {
  console.log(`Processing report job: ${job.name}`, job.data);
  switch (job.name) {
    case "generate-daily":
      // Generate daily summary report
      break;
    case "generate-weekly":
      // Generate weekly report
      break;
    case "generate-monthly":
      // Generate monthly report
      break;
    default:
      console.warn(`Unknown report job: ${job.name}`);
  }
}

async function processMaintenanceJob(job: { name: string; data: unknown }) {
  console.log(`Processing maintenance job: ${job.name}`, job.data);
  switch (job.name) {
    case "check-equipment-service":
      // Check for equipment needing service
      break;
    case "cleanup-expired-sessions":
      // Remove expired sessions
      break;
    case "check-trial-expirations":
      // Check for trials expiring soon
      break;
    default:
      console.warn(`Unknown maintenance job: ${job.name}`);
  }
}

// Start workers
function startWorkers() {
  console.log("Starting background workers...");

  // Email worker
  const emailWorker = new Worker(
    QUEUES.EMAIL,
    async (job) => {
      await processEmailJob({ name: job.name, data: job.data });
    },
    { connection, concurrency: 5 }
  );

  emailWorker.on("completed", (job) => {
    console.log(`Email job ${job.id} completed`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err);
  });

  // Booking worker
  const bookingWorker = new Worker(
    QUEUES.BOOKING,
    async (job) => {
      await processBookingJob({ name: job.name, data: job.data });
    },
    { connection, concurrency: 3 }
  );

  bookingWorker.on("completed", (job) => {
    console.log(`Booking job ${job.id} completed`);
  });

  bookingWorker.on("failed", (job, err) => {
    console.error(`Booking job ${job?.id} failed:`, err);
  });

  // Report worker
  const reportWorker = new Worker(
    QUEUES.REPORT,
    async (job) => {
      await processReportJob({ name: job.name, data: job.data });
    },
    { connection, concurrency: 1 }
  );

  reportWorker.on("completed", (job) => {
    console.log(`Report job ${job.id} completed`);
  });

  reportWorker.on("failed", (job, err) => {
    console.error(`Report job ${job?.id} failed:`, err);
  });

  // Maintenance worker
  const maintenanceWorker = new Worker(
    QUEUES.MAINTENANCE,
    async (job) => {
      await processMaintenanceJob({ name: job.name, data: job.data });
    },
    { connection, concurrency: 2 }
  );

  maintenanceWorker.on("completed", (job) => {
    console.log(`Maintenance job ${job.id} completed`);
  });

  maintenanceWorker.on("failed", (job, err) => {
    console.error(`Maintenance job ${job?.id} failed:`, err);
  });

  console.log("Workers started. Waiting for jobs...");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down workers...");
    await emailWorker.close();
    await bookingWorker.close();
    await reportWorker.close();
    await maintenanceWorker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorkers();
}

export { startWorkers };
