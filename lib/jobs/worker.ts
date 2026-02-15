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
import type { ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import {
  sendEmail,
  bookingConfirmationEmail,
  bookingReminderEmail,
  passwordResetEmail,
  welcomeEmail,
  customerWelcomeEmail,
} from "../email";
import { cleanupStaleTenants } from "./stale-tenant-cleanup";
import { startQuickBooksSyncWorker } from "./quickbooks-sync.server";
import { db } from "../db";
import { organization } from "../db/schema/auth";
import { bookings, trips, tours, customers } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { jobLogger } from "../logger";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
// Cast to ConnectionOptions to avoid ioredis version conflicts between packages
const connection = redisClient as unknown as ConnectionOptions;

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

// Email job data types
interface BookingConfirmationJobData {
  to: string;
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  participants: number;
  total: string;
  bookingNumber: string;
  shopName: string;
}

interface BookingReminderJobData {
  to: string;
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  bookingNumber: string;
  shopName: string;
}

interface PasswordResetJobData {
  to: string;
  userName: string;
  resetUrl: string;
}

interface WelcomeJobData {
  to: string;
  userName: string;
  shopName: string;
  loginUrl: string;
}

interface CustomerWelcomeJobData {
  to: string;
  customerName: string;
  shopName: string;
  loginUrl: string;
}

// Job handlers
async function processEmailJob(job: { name: string; data: unknown }) {
  jobLogger.info({ jobName: job.name, jobData: job.data }, "Processing email job");

  switch (job.name) {
    case "booking-confirmation": {
      const data = job.data as BookingConfirmationJobData;
      const email = bookingConfirmationEmail({
        customerName: data.customerName,
        tripName: data.tripName,
        tripDate: data.tripDate,
        tripTime: data.tripTime,
        participants: data.participants,
        total: data.total,
        bookingNumber: data.bookingNumber,
        shopName: data.shopName,
      });
      await sendEmail({ to: data.to, ...email });
      break;
    }
    case "booking-reminder": {
      const data = job.data as BookingReminderJobData;
      const email = bookingReminderEmail({
        customerName: data.customerName,
        tripName: data.tripName,
        tripDate: data.tripDate,
        tripTime: data.tripTime,
        bookingNumber: data.bookingNumber,
        shopName: data.shopName,
      });
      await sendEmail({ to: data.to, ...email });
      break;
    }
    case "password-reset": {
      const data = job.data as PasswordResetJobData;
      const email = passwordResetEmail({
        userName: data.userName,
        resetUrl: data.resetUrl,
      });
      await sendEmail({ to: data.to, ...email });
      break;
    }
    case "welcome": {
      const data = job.data as WelcomeJobData;
      const email = welcomeEmail({
        userName: data.userName,
        shopName: data.shopName,
        loginUrl: data.loginUrl,
      });
      await sendEmail({ to: data.to, ...email });
      break;
    }
    case "customer-welcome": {
      const data = job.data as CustomerWelcomeJobData;
      const email = customerWelcomeEmail({
        customerName: data.customerName,
        shopName: data.shopName,
        loginUrl: data.loginUrl,
      });
      await sendEmail({ to: data.to, ...email });
      break;
    }
    default:
      jobLogger.warn({ jobName: job.name }, "Unknown email job");
  }
}

async function processBookingJob(job: { name: string; data: unknown }) {
  jobLogger.info({ jobName: job.name, jobData: job.data }, "Processing booking job");
  switch (job.name) {
    case "send-reminders": {
      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const tomorrowDateStr = tomorrow.toISOString().split("T")[0];

      jobLogger.info({ date: tomorrowDateStr, rangeStart: tomorrow.toISOString(), rangeEnd: tomorrowEnd.toISOString() }, "Processing booking reminders");

      // Multi-tenant implementation: Single batch query for all confirmed bookings tomorrow across all organizations
      let totalRemindersQueued = 0;

      try {
        // Single query: get all confirmed bookings for tomorrow across all organizations,
        // joining with organization table to get shop names
        const tomorrowBookings = await db
          .select({
            bookingId: bookings.id,
            bookingNumber: bookings.bookingNumber,
            customerEmail: customers.email,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
            tripDate: trips.date,
            tripStartTime: trips.startTime,
            tourName: tours.name,
            orgName: organization.name,
            orgSlug: organization.slug,
          })
          .from(bookings)
          .innerJoin(trips, eq(bookings.tripId, trips.id))
          .innerJoin(tours, eq(trips.tourId, tours.id))
          .innerJoin(customers, eq(bookings.customerId, customers.id))
          .innerJoin(organization, eq(bookings.organizationId, organization.id))
          .where(
            and(
              eq(bookings.status, "confirmed"),
              eq(trips.date, tomorrowDateStr)
            )
          );

        jobLogger.info({ totalBookings: tomorrowBookings.length }, "Found bookings for tomorrow across all organizations");

        // Queue a "booking-reminder" email job for each booking
        for (const booking of tomorrowBookings) {
          const customerName = `${booking.customerFirstName} ${booking.customerLastName}`.trim();

          try {
            await emailQueue.add("booking-reminder", {
              to: booking.customerEmail,
              customerName: customerName,
              tripName: booking.tourName,
              tripDate: booking.tripDate,
              tripTime: booking.tripStartTime,
              bookingNumber: booking.bookingNumber,
              shopName: booking.orgName,
            });

            totalRemindersQueued++;
            jobLogger.info({ bookingNumber: booking.bookingNumber, to: booking.customerEmail, org: booking.orgSlug }, "Queued booking reminder");
          } catch (queueError) {
            jobLogger.error({ err: queueError, bookingNumber: booking.bookingNumber, org: booking.orgSlug }, "Error queuing booking reminder");
            // Continue to next booking even if one fails
          }
        }

        jobLogger.info({ totalRemindersQueued }, "Send reminders complete");
      } catch (error) {
        jobLogger.error({ err: error }, "Fatal error querying bookings for reminders");
        throw error;
      }
      break;
    }
    case "mark-no-shows":
      // Mark no-shows for trips that have completed
      break;
    case "update-customer-stats":
      // Update customer dive counts and spending
      break;
    default:
      jobLogger.warn({ jobName: job.name }, "Unknown booking job");
  }
}

async function processReportJob(job: { name: string; data: unknown }) {
  jobLogger.info({ jobName: job.name, jobData: job.data }, "Processing report job");
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
      jobLogger.warn({ jobName: job.name }, "Unknown report job");
  }
}

async function processMaintenanceJob(job: { name: string; data: unknown }) {
  jobLogger.info({ jobName: job.name, jobData: job.data }, "Processing maintenance job");
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
    case "cleanup-stale-tenants": {
      // Clean up inactive free-tier organizations
      const results = await cleanupStaleTenants();
      jobLogger.info({ results }, "Stale tenant cleanup complete");
      break;
    }
    default:
      jobLogger.warn({ jobName: job.name }, "Unknown maintenance job");
  }
}

// Start workers
function startWorkers() {
  jobLogger.info("Starting background workers...");

  // Email worker
  const emailWorker = new Worker(
    QUEUES.EMAIL,
    async (job) => {
      await processEmailJob({ name: job.name, data: job.data });
    },
    { connection, concurrency: 5 }
  );

  emailWorker.on("completed", (job) => {
    jobLogger.info({ jobId: job.id, queue: "email" }, "Job completed");
  });

  emailWorker.on("failed", (job, err) => {
    jobLogger.error({ err, jobId: job?.id, queue: "email" }, "Job failed");
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
    jobLogger.info({ jobId: job.id, queue: "booking" }, "Job completed");
  });

  bookingWorker.on("failed", (job, err) => {
    jobLogger.error({ err, jobId: job?.id, queue: "booking" }, "Job failed");
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
    jobLogger.info({ jobId: job.id, queue: "report" }, "Job completed");
  });

  reportWorker.on("failed", (job, err) => {
    jobLogger.error({ err, jobId: job?.id, queue: "report" }, "Job failed");
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
    jobLogger.info({ jobId: job.id, queue: "maintenance" }, "Job completed");
  });

  maintenanceWorker.on("failed", (job, err) => {
    jobLogger.error({ err, jobId: job?.id, queue: "maintenance" }, "Job failed");
  });

  // QuickBooks sync worker
  const quickbooksWorker = startQuickBooksSyncWorker();

  jobLogger.info("Workers started. Waiting for jobs...");

  // Graceful shutdown
  const shutdown = async () => {
    jobLogger.info("Shutting down workers...");
    await emailWorker.close();
    await bookingWorker.close();
    await reportWorker.close();
    await maintenanceWorker.close();
    await quickbooksWorker.close();
    await redisClient.quit();
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
