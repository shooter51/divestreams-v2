/**
 * Zapier Webhook Worker
 *
 * BullMQ worker that processes webhook deliveries with retry logic.
 */

import { Worker, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { deliverWebhook } from "../integrations/zapier-enhanced.server";
import { jobLogger } from "../logger";

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

    jobLogger.info(
      { eventType, targetUrl, attempt: job.attemptsMade + 1 },
      "Delivering Zapier webhook"
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

    jobLogger.info(
      { eventType, statusCode: result.statusCode },
      "Successfully delivered Zapier webhook"
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
  jobLogger.info({ jobId: job.id }, "Zapier webhook worker job completed successfully");
});

zapierWebhookWorker.on("failed", (job, err) => {
  jobLogger.error(
    { err, jobId: job?.id, attemptsMade: job?.attemptsMade },
    "Zapier webhook worker job failed"
  );
});

zapierWebhookWorker.on("error", (err) => {
  jobLogger.error({ err }, "Zapier webhook worker error");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  jobLogger.info("Zapier webhook worker received SIGTERM, shutting down gracefully");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  jobLogger.info("Zapier webhook worker received SIGINT, shutting down gracefully");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

jobLogger.info("Zapier webhook worker started and waiting for jobs");
