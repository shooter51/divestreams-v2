/**
 * Webhooks Schema Tables
 *
 * Handles webhook configuration and delivery tracking for organizations.
 * Enables real-time event notifications to external services.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

/**
 * Supported webhook event types
 */
export const WEBHOOK_EVENTS = [
  "booking.created",
  "booking.updated",
  "booking.cancelled",
  "customer.created",
  "customer.updated",
  "payment.received",
  "payment.refunded",
  "trip.completed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

/**
 * Webhook delivery status
 */
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

// ============================================================================
// WEBHOOKS TABLE
// ============================================================================

/**
 * Webhooks table - Webhook endpoint configurations per organization
 *
 * Stores webhook URLs and their subscribed events.
 * Each organization can have multiple webhook endpoints.
 */
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // For HMAC signature verification
    events: jsonb("events").notNull().$type<WebhookEventType[]>(),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"), // Optional user-friendly description
    lastDeliveryAt: timestamp("last_delivery_at"),
    lastDeliveryStatus: text("last_delivery_status").$type<WebhookDeliveryStatus>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("webhooks_org_idx").on(table.organizationId),
    index("webhooks_org_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// WEBHOOK DELIVERIES TABLE
// ============================================================================

/**
 * Webhook Deliveries table - Tracks individual delivery attempts
 *
 * Records every webhook delivery attempt with payload, status, and response.
 * Supports retry logic with exponential backoff.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull().$type<WebhookEventType>(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    status: text("status").notNull().default("pending").$type<WebhookDeliveryStatus>(),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextRetryAt: timestamp("next_retry_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_webhook_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_retry_idx").on(table.status, table.nextRetryAt),
    index("webhook_deliveries_created_idx").on(table.createdAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  organization: one(organization, {
    fields: [webhooks.organizationId],
    references: [organization.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
