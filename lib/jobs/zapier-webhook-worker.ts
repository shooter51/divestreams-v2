/**
 * Zapier Webhook Worker
 *
 * BullMQ worker that processes webhook deliveries with retry logic.
 */

import { Worker, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { deliverWebhook } from "../integrations/zapier-enhanced.server";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Cast to ConnectionOptions to avoid ioredis version conflicts between packages
const connection = redis as unknown as ConnectionOptions;

/**
 * Worker for processing Zapier webhook deliveries
 */
export const zapierWebhookWorker = new Worker(
  "zapier-webhooks",
  async (job) => {
    const {
      subscriptionId,
      eventType,
      eventData,
      targetUrl,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      organizationId: _organizationId,
    } = job.data;

    console.log(
      `[Zapier Worker] Delivering webhook ${eventType} to ${targetUrl} (attempt ${job.attemptsMade + 1})`
    );

    const result = await deliverWebhook(
      subscriptionId,
      eventType,
      eventData,
      targetUrl,
      job.attemptsMade + 1
    );

    if (!result.success) {
      // Throw error to trigger retry
      throw new Error(result.error || "Webhook delivery failed");
    }

    console.log(
      `[Zapier Worker] Successfully delivered webhook ${eventType} (HTTP ${result.statusCode})`
    );

    return result;
  },
  {
    connection,
    concurrency: 5, // Process up to 5 webhooks concurrently
  }
);

// Event listeners
zapierWebhookWorker.on("completed", (job) => {
  console.log(`[Zapier Worker] Job ${job.id} completed successfully`);
});

zapierWebhookWorker.on("failed", (job, err) => {
  console.error(
    `[Zapier Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
    err.message
  );
});

zapierWebhookWorker.on("error", (err) => {
  console.error("[Zapier Worker] Worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Zapier Worker] Received SIGTERM, shutting down gracefully...");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Zapier Worker] Received SIGINT, shutting down gracefully...");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

console.log("[Zapier Worker] Started and waiting for jobs...");
