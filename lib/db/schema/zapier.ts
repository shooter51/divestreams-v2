/**
 * Zapier Integration Schema
 *
 * Stores webhook subscriptions, API keys, and webhook delivery logs
 * for Zapier workflow automation integration.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ============================================================================
// ZAPIER WEBHOOK SUBSCRIPTIONS TABLE
// ============================================================================

/**
 * Zapier webhook subscriptions - Stores REST Hooks subscriptions
 *
 * When Zapier subscribes to a trigger, we store the webhook URL they provide.
 * When events occur, we POST to these webhook URLs.
 */
export const zapierWebhookSubscriptions = pgTable(
  "zapier_webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Event type this subscription is for
    eventType: text("event_type").notNull(), // e.g., "booking.created"

    // Zapier's webhook URL to send events to
    targetUrl: text("target_url").notNull(),

    // Optional filters (for future enhancement)
    filters: jsonb("filters").$type<{
      tripType?: string;
      minAmount?: number;
      status?: string[];
      [key: string]: unknown;
    }>(),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at"),
    lastError: text("last_error"),
    failureCount: integer("failure_count").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("zapier_webhooks_org_idx").on(table.organizationId),
    index("zapier_webhooks_event_idx").on(table.eventType),
    index("zapier_webhooks_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// ZAPIER WEBHOOK DELIVERY LOG TABLE
// ============================================================================

/**
 * Zapier webhook delivery log - Tracks webhook deliveries for debugging
 */
export const zapierWebhookDeliveryLog = pgTable(
  "zapier_webhook_delivery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => zapierWebhookSubscriptions.id, { onDelete: "cascade" }),

    // Event details
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data").notNull(),

    // Delivery attempt details
    targetUrl: text("target_url").notNull(),
    httpStatus: integer("http_status"),
    responseBody: text("response_body"),
    errorMessage: text("error_message"),

    // Retry tracking
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: text("status").notNull().default("pending"), // pending, success, failed

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at"),
  },
  (table) => [
    index("zapier_delivery_log_subscription_idx").on(table.subscriptionId),
    index("zapier_delivery_log_status_idx").on(table.status),
    index("zapier_delivery_log_created_idx").on(table.createdAt),
  ]
);

// ============================================================================
// ZAPIER API KEYS TABLE
// ============================================================================

/**
 * Zapier API keys - Organization-specific API keys for Zapier actions
 *
 * Each organization gets an API key that Zapier uses to authenticate
 * when calling our action endpoints (create booking, update customer, etc.)
 */
export const zapierApiKeys = pgTable(
  "zapier_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // API key (hashed)
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (e.g., "zap_dev_")

    // Key metadata
    label: text("label"), // Optional user-provided label
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"), // Optional expiration

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("zapier_api_keys_org_idx").on(table.organizationId),
    index("zapier_api_keys_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ZapierWebhookSubscription = typeof zapierWebhookSubscriptions.$inferSelect;
export type NewZapierWebhookSubscription = typeof zapierWebhookSubscriptions.$inferInsert;

export type ZapierWebhookDeliveryLog = typeof zapierWebhookDeliveryLog.$inferSelect;
export type NewZapierWebhookDeliveryLog = typeof zapierWebhookDeliveryLog.$inferInsert;

export type ZapierApiKey = typeof zapierApiKeys.$inferSelect;
export type NewZapierApiKey = typeof zapierApiKeys.$inferInsert;
