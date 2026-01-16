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
} from "../email";
import { cleanupStaleTenants } from "./stale-tenant-cleanup";
import { db } from "../db";
import { organization } from "../db/schema/auth";
import { bookings, trips, tours, customers } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

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

// Job handlers
async function processEmailJob(job: { name: string; data: unknown }) {
  console.log(`Processing email job: ${job.name}`, job.data);

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
    default:
      console.warn(`Unknown email job: ${job.name}`);
  }
}

async function processBookingJob(job: { name: string; data: unknown }) {
  console.log(`Processing booking job: ${job.name}`, job.data);
  switch (job.name) {
    case "send-reminders": {
      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const tomorrowDateStr = tomorrow.toISOString().split("T")[0];

      console.log(`[send-reminders] Processing booking reminders for ${tomorrowDateStr}`);
      console.log(`[send-reminders] Date range: ${tomorrow.toISOString()} to ${tomorrowEnd.toISOString()}`);

      // Multi-tenant implementation: Query all active organizations and their bookings for tomorrow
      let totalRemindersQueued = 0;
      let organizationsProcessed = 0;

      try {
        // 1. Query all organizations
        const organizations = await db
          .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          })
          .from(organization);

        console.log(`[send-reminders] Found ${organizations.length} organizations to process`);

        // 2. For each organization, query confirmed bookings with trips scheduled for tomorrow
        for (const org of organizations) {
          try {
            // Query bookings with trips scheduled for tomorrow where status = 'confirmed'
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
              })
              .from(bookings)
              .innerJoin(trips, eq(bookings.tripId, trips.id))
              .innerJoin(tours, eq(trips.tourId, tours.id))
              .innerJoin(customers, eq(bookings.customerId, customers.id))
              .where(
                and(
                  eq(bookings.organizationId, org.id),
                  eq(bookings.status, "confirmed"),
                  eq(trips.date, tomorrowDateStr)
                )
              );

            console.log(`[send-reminders] Organization "${org.name}" (${org.slug}): found ${tomorrowBookings.length} bookings for tomorrow`);

            // 3. For each booking, queue a "booking-reminder" email job
            for (const booking of tomorrowBookings) {
              const customerName = `${booking.customerFirstName} ${booking.customerLastName}`.trim();

              await emailQueue.add("booking-reminder", {
                to: booking.customerEmail,
                customerName: customerName,
                tripName: booking.tourName,
                tripDate: booking.tripDate,
                tripTime: booking.tripStartTime,
                bookingNumber: booking.bookingNumber,
                shopName: org.name,
              });

              totalRemindersQueued++;
              console.log(`[send-reminders] Queued reminder for booking ${booking.bookingNumber} to ${booking.customerEmail}`);
            }

            organizationsProcessed++;
          } catch (orgError) {
            console.error(`[send-reminders] Error processing organization ${org.slug}:`, orgError);
            // Continue to next organization even if one fails
          }
        }

        console.log(`[send-reminders] Complete: Processed ${organizationsProcessed} organizations, queued ${totalRemindersQueued} reminder emails`);
      } catch (error) {
        console.error(`[send-reminders] Fatal error querying organizations:`, error);
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
    case "cleanup-stale-tenants": {
      // Clean up inactive free-tier organizations
      const results = await cleanupStaleTenants();
      console.log(`[cleanup-stale-tenants] Results:`, results);
      break;
    }
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
