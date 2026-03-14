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

    jobLogger.info({ jobName: "zapier-webhook", eventType, targetUrl, attempt: job.attemptsMade + 1 }, "Job started");

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

    jobLogger.info({ jobName: "zapier-webhook", eventType, statusCode: result.statusCode }, "Job started");

    return result;
  },
  {
    connection,
    concurrency: 5, // Process up to 5 webhooks concurrently
  }
);

// Event listeners
zapierWebhookWorker.on("completed", (job) => {
  jobLogger.info({ jobName: "zapier-webhook", jobId: job.id }, "Job started");
});

zapierWebhookWorker.on("failed", (job, err) => {
  jobLogger.error({ err, jobName: "zapier-webhook", jobId: job?.id, attemptsMade: job?.attemptsMade }, "Job failed");
});

zapierWebhookWorker.on("error", (err) => {
  jobLogger.error({ err, jobName: "zapier-webhook" }, "Job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  jobLogger.info({ jobName: "zapier-webhook" }, "Job started");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  jobLogger.info({ jobName: "zapier-webhook" }, "Job started");
  await zapierWebhookWorker.close();
  await redis.quit();
  process.exit(0);
});

jobLogger.info({ jobName: "zapier-webhook" }, "Job started");
