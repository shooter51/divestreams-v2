/**
 * Enhanced Zapier Integration
 *
 * Extends the base Zapier integration with:
 * - REST Hooks webhook subscription management
 * - API key authentication for Zapier actions
 * - Webhook delivery queue with retries
 * - Zapier action endpoints (create booking, update customer, etc.)
 */

import { createHash, randomBytes } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  zapierWebhookSubscriptions,
  zapierWebhookDeliveryLog,
  zapierApiKeys,
  type ZapierWebhookSubscription,
} from "../db/schema/zapier";
import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";

// ============================================================================
// REDIS CONNECTION
// ============================================================================

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Cast to ConnectionOptions to avoid ioredis version conflicts between packages
const connection = redis as unknown as ConnectionOptions;

// ============================================================================
// WEBHOOK QUEUE
// ============================================================================

/**
 * BullMQ queue for webhook deliveries with retry logic
 */
export const zapierWebhookQueue = new Queue("zapier-webhooks", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Generate a new Zapier API key for an organization
 *
 * Format: zap_dev_[32 random hex chars]
 * The key is hashed before storage using SHA-256
 */
export async function generateZapierApiKey(
  orgId: string,
  label?: string
): Promise<{ key: string; keyId: string }> {
  // Generate random key
  const randomPart = randomBytes(24).toString("hex");
  const key = `zap_dev_${randomPart}`;

  // Hash the key for storage
  const keyHash = createHash("sha256").update(key).digest("hex");

  // Store prefix for display
  const keyPrefix = key.substring(0, 16);

  // Insert into database
  const [apiKey] = await db
    .insert(zapierApiKeys)
    .values({
      organizationId: orgId,
      keyHash,
      keyPrefix,
      label,
      isActive: true,
    })
    .returning();

  return {
    key, // Return unhashed key only once
    keyId: apiKey.id,
  };
}

/**
 * Validate a Zapier API key and return the organization ID
 */
export async function validateZapierApiKey(key: string): Promise<string | null> {
  // Hash the provided key
  const keyHash = createHash("sha256").update(key).digest("hex");

  // Look up in database
  const [apiKey] = await db
    .select()
    .from(zapierApiKeys)
    .where(and(eq(zapierApiKeys.keyHash, keyHash), eq(zapierApiKeys.isActive, true)))
    .limit(1);

  if (!apiKey) {
    return null;
  }

  // Check if expired
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return null;
  }

  // Update last used timestamp
  await db
    .update(zapierApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(zapierApiKeys.id, apiKey.id));

  return apiKey.organizationId;
}

/**
 * List API keys for an organization (without the actual key)
 */
export async function listZapierApiKeys(orgId: string): Promise<
  Array<{
    id: string;
    keyPrefix: string;
    label: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
    isActive: boolean;
  }>
> {
  const keys = await db
    .select({
      id: zapierApiKeys.id,
      keyPrefix: zapierApiKeys.keyPrefix,
      label: zapierApiKeys.label,
      createdAt: zapierApiKeys.createdAt,
      lastUsedAt: zapierApiKeys.lastUsedAt,
      isActive: zapierApiKeys.isActive,
    })
    .from(zapierApiKeys)
    .where(eq(zapierApiKeys.organizationId, orgId))
    .orderBy(zapierApiKeys.createdAt);

  return keys;
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeZapierApiKey(keyId: string, orgId: string): Promise<boolean> {
  const result = await db
    .update(zapierApiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(zapierApiKeys.id, keyId), eq(zapierApiKeys.organizationId, orgId)))
    .returning();

  return result.length > 0;
}

// ============================================================================
// WEBHOOK SUBSCRIPTION MANAGEMENT (REST Hooks)
// ============================================================================

/**
 * Subscribe to a Zapier trigger (REST Hook)
 *
 * Called by Zapier when a user sets up a trigger in their Zap.
 */
export async function subscribeWebhook(
  orgId: string,
  eventType: string,
  targetUrl: string
): Promise<ZapierWebhookSubscription> {
  // Validate URL
  try {
    new URL(targetUrl);
  } catch {
    throw new Error("Invalid target URL");
  }

  // Check if subscription already exists
  const existing = await db
    .select()
    .from(zapierWebhookSubscriptions)
    .where(
      and(
        eq(zapierWebhookSubscriptions.organizationId, orgId),
        eq(zapierWebhookSubscriptions.eventType, eventType),
        eq(zapierWebhookSubscriptions.targetUrl, targetUrl)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Reactivate if it exists
    const [updated] = await db
      .update(zapierWebhookSubscriptions)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(zapierWebhookSubscriptions.id, existing[0].id))
      .returning();
    return updated;
  }

  // Create new subscription
  const [subscription] = await db
    .insert(zapierWebhookSubscriptions)
    .values({
      organizationId: orgId,
      eventType,
      targetUrl,
      isActive: true,
    })
    .returning();

  return subscription;
}

/**
 * Unsubscribe from a Zapier trigger
 *
 * Called by Zapier when a user turns off or deletes a trigger.
 */
export async function unsubscribeWebhook(
  orgId: string,
  targetUrl: string,
  eventType?: string
): Promise<boolean> {
  const conditions = [
    eq(zapierWebhookSubscriptions.organizationId, orgId),
    eq(zapierWebhookSubscriptions.targetUrl, targetUrl),
  ];

  if (eventType) {
    conditions.push(eq(zapierWebhookSubscriptions.eventType, eventType));
  }

  const result = await db
    .update(zapierWebhookSubscriptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();

  return result.length > 0;
}

/**
 * List active webhook subscriptions for an organization
 */
export async function listWebhookSubscriptions(
  orgId: string,
  eventType?: string
): Promise<ZapierWebhookSubscription[]> {
  const conditions = [
    eq(zapierWebhookSubscriptions.organizationId, orgId),
    eq(zapierWebhookSubscriptions.isActive, true),
  ];

  if (eventType) {
    conditions.push(eq(zapierWebhookSubscriptions.eventType, eventType));
  }

  return db
    .select()
    .from(zapierWebhookSubscriptions)
    .where(and(...conditions))
    .orderBy(zapierWebhookSubscriptions.createdAt);
}

// ============================================================================
// WEBHOOK DELIVERY
// ============================================================================

/**
 * Trigger a webhook event
 *
 * Queues webhook delivery to all subscribed Zapier endpoints.
 * Uses BullMQ for reliable delivery with retries.
 */
export async function triggerWebhookEvent(
  orgId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<{ queued: number; subscriptions: number }> {
  // Get all active subscriptions for this event
  const subscriptions = await listWebhookSubscriptions(orgId, eventType);

  if (subscriptions.length === 0) {
    return { queued: 0, subscriptions: 0 };
  }

  // Queue webhook delivery for each subscription
  let queued = 0;
  for (const subscription of subscriptions) {
    try {
      await zapierWebhookQueue.add(
        "deliver-webhook",
        {
          subscriptionId: subscription.id,
          eventType,
          eventData,
          targetUrl: subscription.targetUrl,
          organizationId: orgId,
        },
        {
          jobId: `${subscription.id}-${Date.now()}`,
        }
      );
      queued++;
    } catch (error) {
      console.error("Failed to queue webhook delivery:", error);
    }
  }

  return { queued, subscriptions: subscriptions.length };
}

/**
 * Deliver a webhook (called by worker)
 *
 * This function is called by the BullMQ worker to actually send the webhook.
 */
export async function deliverWebhook(
  subscriptionId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  targetUrl: string,
  attemptNumber = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  // Create delivery log entry
  const [logEntry] = await db
    .insert(zapierWebhookDeliveryLog)
    .values({
      subscriptionId,
      eventType,
      eventData,
      targetUrl,
      attemptNumber,
      status: "pending",
    })
    .returning();

  try {
    // Build payload
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
    };

    // Send webhook
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DiveStreams-Zapier/1.0",
        "X-Zapier-Event": eventType,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseBody = await response.text().catch(() => "");

    // Update log entry
    await db
      .update(zapierWebhookDeliveryLog)
      .set({
        status: response.ok ? "success" : "failed",
        httpStatus: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit size
        deliveredAt: new Date(),
      })
      .where(eq(zapierWebhookDeliveryLog.id, logEntry.id));

    // Update subscription
    if (response.ok) {
      await db
        .update(zapierWebhookSubscriptions)
        .set({
          lastTriggeredAt: new Date(),
          lastError: null,
          failureCount: 0,
        })
        .where(eq(zapierWebhookSubscriptions.id, subscriptionId));

      return { success: true, statusCode: response.status };
    } else {
      // Increment failure count
      await db
        .update(zapierWebhookSubscriptions)
        .set({
          lastError: `HTTP ${response.status}`,
          failureCount: sql`${zapierWebhookSubscriptions.failureCount} + 1`,
        })
        .where(eq(zapierWebhookSubscriptions.id, subscriptionId));

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${responseBody}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";

    // Update log entry
    await db
      .update(zapierWebhookDeliveryLog)
      .set({
        status: "failed",
        errorMessage,
        deliveredAt: new Date(),
      })
      .where(eq(zapierWebhookDeliveryLog.id, logEntry.id));

    // Update subscription
    await db
      .update(zapierWebhookSubscriptions)
      .set({
        lastError: errorMessage,
        failureCount: sql`${zapierWebhookSubscriptions.failureCount} + 1`,
      })
      .where(eq(zapierWebhookSubscriptions.id, subscriptionId));

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// WEBHOOK STATISTICS
// ============================================================================

/**
 * Get webhook delivery statistics for an organization
 */
export async function getWebhookStats(orgId: string): Promise<{
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  recentDeliveries: Array<{
    id: string;
    eventType: string;
    status: string;
    createdAt: Date;
    deliveredAt: Date | null;
  }>;
}> {
  // Get subscriptions
  const subscriptions = await db
    .select()
    .from(zapierWebhookSubscriptions)
    .where(eq(zapierWebhookSubscriptions.organizationId, orgId));

  const activeSubscriptions = subscriptions.filter((s) => s.isActive).length;

  // Get subscription IDs for this org
  const subscriptionIds = subscriptions.map((s) => s.id);

  if (subscriptionIds.length === 0) {
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      recentDeliveries: [],
    };
  }

  // Get delivery stats
  const deliveries = await db
    .select({
      id: zapierWebhookDeliveryLog.id,
      eventType: zapierWebhookDeliveryLog.eventType,
      status: zapierWebhookDeliveryLog.status,
      createdAt: zapierWebhookDeliveryLog.createdAt,
      deliveredAt: zapierWebhookDeliveryLog.deliveredAt,
    })
    .from(zapierWebhookDeliveryLog)
    .where(
      sql`${zapierWebhookDeliveryLog.subscriptionId} = ANY(${subscriptionIds})`
    )
    .orderBy(sql`${zapierWebhookDeliveryLog.createdAt} DESC`)
    .limit(50);

  const successfulDeliveries = deliveries.filter((d) => d.status === "success").length;
  const failedDeliveries = deliveries.filter((d) => d.status === "failed").length;

  return {
    totalSubscriptions: subscriptions.length,
    activeSubscriptions,
    totalDeliveries: deliveries.length,
    successfulDeliveries,
    failedDeliveries,
    recentDeliveries: deliveries.slice(0, 10),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an organization has Zapier configured
 */
export async function hasZapierConfigured(orgId: string): Promise<boolean> {
  const keys = await db
    .select()
    .from(zapierApiKeys)
    .where(and(eq(zapierApiKeys.organizationId, orgId), eq(zapierApiKeys.isActive, true)))
    .limit(1);

  return keys.length > 0;
}
