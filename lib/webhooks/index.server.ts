/**
 * Webhook Utilities
 *
 * Core webhook management functions for creating, updating, and triggering webhooks.
 * Includes HMAC signature generation for payload verification.
 */

import { randomBytes, createHmac } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  webhooks,
  webhookDeliveries,
  WEBHOOK_EVENTS,
  type WebhookEventType,
  type Webhook,
  type NewWebhook,
  type WebhookDelivery,
} from "../db/schema/webhooks";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Supported webhook events with descriptions
 */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  "booking.created": "When a new booking is created",
  "booking.updated": "When a booking is modified",
  "booking.cancelled": "When a booking is cancelled",
  "customer.created": "When a new customer is added",
  "customer.updated": "When customer details are updated",
  "payment.received": "When a payment is received",
  "payment.refunded": "When a payment is refunded",
  "trip.completed": "When a trip is marked as completed",
};

/**
 * Re-export webhook events for convenience
 */
export { WEBHOOK_EVENTS };
export type { WebhookEventType };

// ============================================================================
// SIGNATURE FUNCTIONS
// ============================================================================

/**
 * Generate a secure webhook secret
 *
 * Creates a 32-byte random hex string prefixed with 'whsec_'
 * Format: whsec_<64 hex characters>
 */
export function generateWebhookSecret(): string {
  const bytes = randomBytes(32);
  return `whsec_${bytes.toString("hex")}`;
}

/**
 * Sign a webhook payload using HMAC-SHA256
 *
 * The signature is computed as: HMAC-SHA256(timestamp.payload, secret)
 * This prevents replay attacks by including the timestamp.
 *
 * @param payload - The JSON payload to sign
 * @param secret - The webhook secret (with or without 'whsec_' prefix)
 * @param timestamp - Unix timestamp (defaults to current time)
 * @returns The signature in format: t=<timestamp>,v1=<signature>
 */
export function signPayload(
  payload: Record<string, unknown>,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);

  // Remove prefix if present for HMAC computation
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  // Create signature: HMAC-SHA256(timestamp.payload)
  const signaturePayload = `${ts}.${payloadString}`;
  const signature = createHmac("sha256", secretKey)
    .update(signaturePayload)
    .digest("hex");

  return `t=${ts},v1=${signature}`;
}

/**
 * Verify a webhook signature
 *
 * @param payload - The received payload
 * @param signature - The X-DiveStreams-Signature header value
 * @param secret - The webhook secret
 * @param tolerance - Maximum age in seconds (default: 300 = 5 minutes)
 * @returns true if valid, false otherwise
 */
export function verifySignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string,
  tolerance: number = 300
): boolean {
  try {
    // Parse signature header
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const receivedSignature = signaturePart.slice(3);

    // Check timestamp is within tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Compute expected signature
    const expectedSignature = signPayload(payload, secret, timestamp);
    const expectedSig = expectedSignature.split(",")[1].slice(3);

    // Constant-time comparison to prevent timing attacks
    return receivedSignature.length === expectedSig.length &&
      createHmac("sha256", "compare")
        .update(receivedSignature)
        .digest("hex") ===
      createHmac("sha256", "compare")
        .update(expectedSig)
        .digest("hex");
  } catch {
    return false;
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new webhook endpoint
 *
 * @param organizationId - The organization ID
 * @param url - The webhook endpoint URL
 * @param events - Array of event types to subscribe to
 * @param description - Optional description
 * @returns The created webhook
 */
export async function createWebhook(
  organizationId: string,
  url: string,
  events: WebhookEventType[],
  description?: string
): Promise<Webhook> {
  // Validate events
  const validEvents = events.filter((e) =>
    WEBHOOK_EVENTS.includes(e as WebhookEventType)
  );

  if (validEvents.length === 0) {
    throw new Error("At least one valid event type is required");
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  const secret = generateWebhookSecret();

  const [webhook] = await db
    .insert(webhooks)
    .values({
      organizationId,
      url,
      secret,
      events: validEvents,
      description,
      isActive: true,
    })
    .returning();

  return webhook;
}

/**
 * Update an existing webhook
 *
 * @param id - The webhook ID
 * @param organizationId - The organization ID (for security)
 * @param updates - Fields to update
 * @returns The updated webhook
 */
export async function updateWebhook(
  id: string,
  organizationId: string,
  updates: Partial<Pick<Webhook, "url" | "events" | "isActive" | "description">>
): Promise<Webhook> {
  // Validate URL if provided
  if (updates.url) {
    try {
      new URL(updates.url);
    } catch {
      throw new Error("Invalid webhook URL");
    }
  }

  // Validate events if provided
  if (updates.events) {
    const validEvents = updates.events.filter((e) =>
      WEBHOOK_EVENTS.includes(e as WebhookEventType)
    );
    if (validEvents.length === 0) {
      throw new Error("At least one valid event type is required");
    }
    updates.events = validEvents;
  }

  const [webhook] = await db
    .update(webhooks)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)))
    .returning();

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  return webhook;
}

/**
 * Delete a webhook
 *
 * @param id - The webhook ID
 * @param organizationId - The organization ID (for security)
 */
export async function deleteWebhook(
  id: string,
  organizationId: string
): Promise<void> {
  const result = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)))
    .returning({ id: webhooks.id });

  if (result.length === 0) {
    throw new Error("Webhook not found");
  }
}

/**
 * Get a webhook by ID
 *
 * @param id - The webhook ID
 * @param organizationId - The organization ID (for security)
 * @returns The webhook or null
 */
export async function getWebhook(
  id: string,
  organizationId: string
): Promise<Webhook | null> {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)))
    .limit(1);

  return webhook || null;
}

/**
 * List all webhooks for an organization
 *
 * @param organizationId - The organization ID
 * @returns Array of webhooks
 */
export async function listWebhooks(organizationId: string): Promise<Webhook[]> {
  return db
    .select()
    .from(webhooks)
    .where(eq(webhooks.organizationId, organizationId))
    .orderBy(webhooks.createdAt);
}

/**
 * Regenerate a webhook secret
 *
 * @param id - The webhook ID
 * @param organizationId - The organization ID (for security)
 * @returns The updated webhook with new secret
 */
export async function regenerateWebhookSecret(
  id: string,
  organizationId: string
): Promise<Webhook> {
  const newSecret = generateWebhookSecret();

  const [webhook] = await db
    .update(webhooks)
    .set({
      secret: newSecret,
      updatedAt: new Date(),
    })
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)))
    .returning();

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  return webhook;
}

// ============================================================================
// TRIGGER FUNCTIONS
// ============================================================================

/**
 * Trigger a webhook event for an organization
 *
 * This creates delivery records for all active webhooks that are subscribed
 * to the given event type. The actual delivery is handled separately.
 *
 * @param organizationId - The organization ID
 * @param event - The event type
 * @param data - The event data payload
 * @returns Array of created delivery IDs
 */
export async function triggerWebhook(
  organizationId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<string[]> {
  // Find all active webhooks for this org that subscribe to this event
  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.isActive, true)
      )
    );

  // Filter webhooks that are subscribed to this event
  const subscribedWebhooks = activeWebhooks.filter((webhook) =>
    webhook.events.includes(event)
  );

  if (subscribedWebhooks.length === 0) {
    return [];
  }

  // Create payload with event metadata
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    type: event,
    created: Math.floor(Date.now() / 1000),
    data,
  };

  // Create delivery records for each webhook
  const deliveryIds: string[] = [];

  for (const webhook of subscribedWebhooks) {
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        event,
        payload,
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(), // Ready for immediate delivery
      })
      .returning();

    deliveryIds.push(delivery.id);
  }

  return deliveryIds;
}

/**
 * Get recent deliveries for a webhook
 *
 * @param webhookId - The webhook ID
 * @param limit - Maximum number of deliveries to return (default: 20)
 * @returns Array of webhook deliveries
 */
export async function getWebhookDeliveries(
  webhookId: string,
  limit: number = 20
): Promise<WebhookDelivery[]> {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(webhookDeliveries.createdAt)
    .limit(limit);
}

/**
 * Create a test delivery for a webhook
 *
 * @param webhookId - The webhook ID
 * @param organizationId - The organization ID (for security verification)
 * @returns The created test delivery ID
 */
export async function createTestDelivery(
  webhookId: string,
  organizationId: string
): Promise<string> {
  // Verify webhook belongs to org
  const webhook = await getWebhook(webhookId, organizationId);
  if (!webhook) {
    throw new Error("Webhook not found");
  }

  // Create test payload
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    type: "test",
    created: Math.floor(Date.now() / 1000),
    data: {
      message: "This is a test webhook delivery from DiveStreams",
      timestamp: new Date().toISOString(),
    },
  };

  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      webhookId,
      event: "booking.created" as WebhookEventType, // Use a valid event type for test
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: 1, // Only try once for tests
      nextRetryAt: new Date(),
    })
    .returning();

  return delivery.id;
}
