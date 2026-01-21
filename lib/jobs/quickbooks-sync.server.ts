/**
 * QuickBooks Sync Background Jobs
 *
 * Handles background syncing of customers, invoices, and payments to QuickBooks.
 * Jobs are queued via BullMQ and processed asynchronously.
 */

import { Queue, Worker } from "bullmq";
import { getBullMQConnection } from "../redis.server";
import {
  syncBookingToQuickBooks,
  createQuickBooksCustomer,
  createQuickBooksPayment,
} from "../integrations/quickbooks.server";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { integrations } from "../db/schema/integrations";
import { quickbooksSyncRecords } from "../db/schema/quickbooks";

// ============================================================================
// QUEUE SETUP
// ============================================================================

const QUEUE_NAME = "quickbooks-sync";

/**
 * Get QuickBooks sync queue
 */
export function getQuickBooksSyncQueue(): Queue {
  const connection = getBullMQConnection();
  return new Queue(QUEUE_NAME, { connection });
}

// ============================================================================
// JOB TYPES
// ============================================================================

interface SyncBookingJob {
  type: "sync-booking";
  organizationId: string;
  bookingId: string;
}

interface SyncCustomerJob {
  type: "sync-customer";
  organizationId: string;
  customerId: string;
  customerData: {
    name: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
}

interface SyncPaymentJob {
  type: "sync-payment";
  organizationId: string;
  paymentId: string;
  paymentData: {
    customerId: string;
    amount: number;
    paymentDate?: string;
    invoiceId?: string;
  };
}

type QuickBooksSyncJob = SyncBookingJob | SyncCustomerJob | SyncPaymentJob;

// ============================================================================
// JOB QUEUEING
// ============================================================================

/**
 * Queue a booking sync job
 */
export async function queueBookingSync(organizationId: string, bookingId: string) {
  const queue = getQuickBooksSyncQueue();
  await queue.add(
    "sync-booking",
    {
      type: "sync-booking",
      organizationId,
      bookingId,
    } as SyncBookingJob,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}

/**
 * Queue a customer sync job
 */
export async function queueCustomerSync(
  organizationId: string,
  customerId: string,
  customerData: SyncCustomerJob["customerData"]
) {
  const queue = getQuickBooksSyncQueue();
  await queue.add(
    "sync-customer",
    {
      type: "sync-customer",
      organizationId,
      customerId,
      customerData,
    } as SyncCustomerJob,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}

/**
 * Queue a payment sync job
 */
export async function queuePaymentSync(
  organizationId: string,
  paymentId: string,
  paymentData: SyncPaymentJob["paymentData"]
) {
  const queue = getQuickBooksSyncQueue();
  await queue.add(
    "sync-payment",
    {
      type: "sync-payment",
      organizationId,
      paymentId,
      paymentData,
    } as SyncPaymentJob,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}

// ============================================================================
// JOB PROCESSING
// ============================================================================

/**
 * Check if QuickBooks sync is enabled for organization
 */
async function isSyncEnabled(organizationId: string): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.provider, "quickbooks"),
        eq(integrations.isActive, true)
      )
    )
    .limit(1);

  if (!integration) {
    return false;
  }

  const settings = integration.settings as { autoSyncEnabled?: boolean } | null;
  return settings?.autoSyncEnabled ?? false;
}

/**
 * Create sync record
 */
async function createSyncRecord(
  organizationId: string,
  integrationId: string,
  entityType: "customer" | "invoice" | "payment",
  divestreamsId: string,
  quickbooksId: string
) {
  await db.insert(quickbooksSyncRecords).values({
    organizationId,
    integrationId,
    entityType,
    divestreamsId,
    quickbooksId,
    syncStatus: "synced",
    lastSyncedAt: new Date(),
  });
}

/**
 * Update sync record
 */
async function updateSyncRecord(
  organizationId: string,
  entityType: "customer" | "invoice" | "payment",
  divestreamsId: string,
  status: "synced" | "failed",
  error?: string
) {
  await db
    .update(quickbooksSyncRecords)
    .set({
      syncStatus: status,
      lastSyncedAt: new Date(),
      lastSyncError: error,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quickbooksSyncRecords.organizationId, organizationId),
        eq(quickbooksSyncRecords.entityType, entityType),
        eq(quickbooksSyncRecords.divestreamsId, divestreamsId)
      )
    );
}

/**
 * Process QuickBooks sync jobs
 */
async function processQuickBooksSync(job: { data: QuickBooksSyncJob }) {
  const { data } = job;

  // Check if sync is enabled
  const syncEnabled = await isSyncEnabled(data.organizationId);
  if (!syncEnabled) {
    console.log(
      `QuickBooks sync disabled for org ${data.organizationId}, skipping ${data.type}`
    );
    return;
  }

  try {
    switch (data.type) {
      case "sync-booking": {
        const result = await syncBookingToQuickBooks(data.organizationId, data.bookingId);
        if (result.success && result.invoiceId) {
          // Get integration ID
          const [integration] = await db
            .select()
            .from(integrations)
            .where(
              and(
                eq(integrations.organizationId, data.organizationId),
                eq(integrations.provider, "quickbooks")
              )
            )
            .limit(1);

          if (integration) {
            await createSyncRecord(
              data.organizationId,
              integration.id,
              "invoice",
              data.bookingId,
              result.invoiceId
            );
          }
        } else {
          await updateSyncRecord(
            data.organizationId,
            "invoice",
            data.bookingId,
            "failed",
            result.error
          );
          throw new Error(result.error || "Failed to sync booking");
        }
        break;
      }

      case "sync-customer": {
        const result = await createQuickBooksCustomer(data.organizationId, data.customerData);
        if (result.success && result.customerId) {
          const [integration] = await db
            .select()
            .from(integrations)
            .where(
              and(
                eq(integrations.organizationId, data.organizationId),
                eq(integrations.provider, "quickbooks")
              )
            )
            .limit(1);

          if (integration) {
            await createSyncRecord(
              data.organizationId,
              integration.id,
              "customer",
              data.customerId,
              result.customerId
            );
          }
        } else {
          await updateSyncRecord(
            data.organizationId,
            "customer",
            data.customerId,
            "failed",
            result.error
          );
          throw new Error(result.error || "Failed to sync customer");
        }
        break;
      }

      case "sync-payment": {
        const result = await createQuickBooksPayment(data.organizationId, data.paymentData);
        if (result.success && result.paymentId) {
          const [integration] = await db
            .select()
            .from(integrations)
            .where(
              and(
                eq(integrations.organizationId, data.organizationId),
                eq(integrations.provider, "quickbooks")
              )
            )
            .limit(1);

          if (integration) {
            await createSyncRecord(
              data.organizationId,
              integration.id,
              "payment",
              data.paymentId,
              result.paymentId
            );
          }
        } else {
          await updateSyncRecord(
            data.organizationId,
            "payment",
            data.paymentId,
            "failed",
            result.error
          );
          throw new Error(result.error || "Failed to sync payment");
        }
        break;
      }
    }
  } catch (error) {
    console.error(`QuickBooks sync failed for ${data.type}:`, error);
    throw error;
  }
}

// ============================================================================
// WORKER
// ============================================================================

/**
 * Start QuickBooks sync worker
 */
export function startQuickBooksSyncWorker() {
  const connection = getBullMQConnection();

  const worker = new Worker(QUEUE_NAME, processQuickBooksSync, {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });

  worker.on("completed", (job) => {
    console.log(`QuickBooks sync job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`QuickBooks sync job ${job?.id} failed:`, err);
  });

  console.log("QuickBooks sync worker started");

  return worker;
}
