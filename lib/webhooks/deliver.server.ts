/**
 * Webhook Delivery Service
 *
 * Handles the actual HTTP delivery of webhooks with retry logic
 * and exponential backoff.
 */

import { eq, and, lte, or } from "drizzle-orm";
import { db } from "../db";
import {
  webhooks,
  webhookDeliveries,
  type WebhookDeliveryStatus,
} from "../db/schema/webhooks";
import { signPayload } from "./index.server";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of retry attempts
 */
const MAX_ATTEMPTS = 5;

/**
 * Base delay for exponential backoff (in seconds)
 */
const BASE_RETRY_DELAY = 60; // 1 minute

/**
 * Maximum delay for exponential backoff (in seconds)
 */
const MAX_RETRY_DELAY = 3600; // 1 hour

/**
 * Timeout for webhook HTTP requests (in milliseconds)
 */
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// DELIVERY FUNCTIONS
// ============================================================================

/**
 * Calculate the next retry time using exponential backoff
 *
 * Delay = min(BASE_RETRY_DELAY * 2^attempts, MAX_RETRY_DELAY)
 * With some jitter to prevent thundering herd
 *
 * @param attempts - Number of attempts made so far
 * @returns Date for next retry
 */
function calculateNextRetry(attempts: number): Date {
  const delay = Math.min(
    BASE_RETRY_DELAY * Math.pow(2, attempts),
    MAX_RETRY_DELAY
  );
  // Add 10% jitter
  const jitter = delay * 0.1 * Math.random();
  const totalDelay = delay + jitter;

  return new Date(Date.now() + totalDelay * 1000);
}

/**
 * Deliver a single webhook
 *
 * @param deliveryId - The delivery ID to attempt
 * @returns Success status
 */
export async function deliverWebhook(deliveryId: string): Promise<boolean> {
  // Get the delivery with webhook details
  const [delivery] = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      event: webhookDeliveries.event,
      payload: webhookDeliveries.payload,
      attempts: webhookDeliveries.attempts,
      maxAttempts: webhookDeliveries.maxAttempts,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!delivery) {
    console.error(`Webhook delivery not found: ${deliveryId}`);
    return false;
  }

  // Get the webhook configuration
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, delivery.webhookId))
    .limit(1);

  if (!webhook) {
    // Webhook was deleted, mark delivery as failed
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed" as WebhookDeliveryStatus,
        responseBody: "Webhook configuration not found",
        completedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return false;
  }

  if (!webhook.isActive) {
    // Webhook is disabled, mark delivery as failed
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed" as WebhookDeliveryStatus,
        responseBody: "Webhook is disabled",
        completedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return false;
  }

  // Increment attempt counter
  const newAttempts = delivery.attempts + 1;

  try {
    // Sign the payload
    const signature = signPayload(
      delivery.payload as Record<string, unknown>,
      webhook.secret
    );

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Make the HTTP request
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DiveStreams-Signature": signature,
          "X-DiveStreams-Event": delivery.event,
          "X-DiveStreams-Delivery": deliveryId,
          "User-Agent": "DiveStreams-Webhook/1.0",
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get response body (limited to 10KB)
      let responseBody: string;
      try {
        const text = await response.text();
        responseBody = text.slice(0, 10240);
      } catch {
        responseBody = "Unable to read response body";
      }

      // Check if successful (2xx status code)
      const isSuccess = response.status >= 200 && response.status < 300;

      if (isSuccess) {
        // Success - update delivery and webhook
        await Promise.all([
          db
            .update(webhookDeliveries)
            .set({
              status: "success" as WebhookDeliveryStatus,
              responseCode: response.status,
              responseBody,
              attempts: newAttempts,
              completedAt: new Date(),
              nextRetryAt: null,
            })
            .where(eq(webhookDeliveries.id, deliveryId)),
          db
            .update(webhooks)
            .set({
              lastDeliveryAt: new Date(),
              lastDeliveryStatus: "success" as WebhookDeliveryStatus,
              updatedAt: new Date(),
            })
            .where(eq(webhooks.id, webhook.id)),
        ]);

        return true;
      }

      // Failed response - check if we should retry
      const shouldRetry = newAttempts < (delivery.maxAttempts || MAX_ATTEMPTS);

      await Promise.all([
        db
          .update(webhookDeliveries)
          .set({
            status: shouldRetry ? ("pending" as WebhookDeliveryStatus) : ("failed" as WebhookDeliveryStatus),
            responseCode: response.status,
            responseBody,
            attempts: newAttempts,
            nextRetryAt: shouldRetry ? calculateNextRetry(newAttempts) : null,
            completedAt: shouldRetry ? null : new Date(),
          })
          .where(eq(webhookDeliveries.id, deliveryId)),
        db
          .update(webhooks)
          .set({
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: shouldRetry ? ("pending" as WebhookDeliveryStatus) : ("failed" as WebhookDeliveryStatus),
            updatedAt: new Date(),
          })
          .where(eq(webhooks.id, webhook.id)),
      ]);

      return false;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    // Network error or timeout
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const shouldRetry = newAttempts < (delivery.maxAttempts || MAX_ATTEMPTS);

    await Promise.all([
      db
        .update(webhookDeliveries)
        .set({
          status: shouldRetry ? ("pending" as WebhookDeliveryStatus) : ("failed" as WebhookDeliveryStatus),
          responseBody: `Delivery failed: ${errorMessage}`,
          attempts: newAttempts,
          nextRetryAt: shouldRetry ? calculateNextRetry(newAttempts) : null,
          completedAt: shouldRetry ? null : new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId)),
      db
        .update(webhooks)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: shouldRetry ? ("pending" as WebhookDeliveryStatus) : ("failed" as WebhookDeliveryStatus),
          updatedAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id)),
    ]);

    return false;
  }
}

/**
 * Process pending webhook deliveries
 *
 * Finds all pending deliveries that are due for retry and attempts to deliver them.
 * This should be called periodically (e.g., every minute via cron job).
 *
 * @param limit - Maximum number of deliveries to process (default: 100)
 * @returns Object with success and failure counts
 */
export async function processPendingDeliveries(
  limit: number = 100
): Promise<{ success: number; failed: number }> {
  const now = new Date();

  // Find pending deliveries that are due
  const pendingDeliveries = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        or(
          lte(webhookDeliveries.nextRetryAt, now),
          eq(webhookDeliveries.attempts, 0) // Never attempted
        )
      )
    )
    .limit(limit);

  let success = 0;
  let failed = 0;

  // Process deliveries sequentially to avoid overwhelming the system
  // In production, consider using a proper job queue
  for (const delivery of pendingDeliveries) {
    try {
      const result = await deliverWebhook(delivery.id);
      if (result) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Error processing delivery ${delivery.id}:`, error);
      failed++;
    }

    // Small delay between deliveries to be nice to external services
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { success, failed };
}

/**
 * Retry a specific failed delivery
 *
 * Resets the delivery to pending status for another attempt.
 *
 * @param deliveryId - The delivery ID to retry
 */
export async function retryDelivery(deliveryId: string): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({
      status: "pending" as WebhookDeliveryStatus,
      nextRetryAt: new Date(), // Immediate retry
      completedAt: null,
    })
    .where(
      and(
        eq(webhookDeliveries.id, deliveryId),
        eq(webhookDeliveries.status, "failed")
      )
    );
}

/**
 * Get delivery statistics for a webhook
 *
 * @param webhookId - The webhook ID
 * @returns Delivery statistics
 */
export async function getDeliveryStats(webhookId: string): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
}> {
  const deliveries = await db
    .select({ status: webhookDeliveries.status })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId));

  return {
    total: deliveries.length,
    success: deliveries.filter((d) => d.status === "success").length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    pending: deliveries.filter((d) => d.status === "pending").length,
  };
}

/**
 * Clean up old delivery records
 *
 * Removes delivery records older than the specified number of days.
 * This should be called periodically to prevent table bloat.
 *
 * @param daysToKeep - Number of days to retain (default: 30)
 * @returns Number of deleted records
 */
export async function cleanupOldDeliveries(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db
    .delete(webhookDeliveries)
    .where(lte(webhookDeliveries.createdAt, cutoffDate))
    .returning({ id: webhookDeliveries.id });

  return result.length;
}
