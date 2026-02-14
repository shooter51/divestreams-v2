/**
 * Integrations Schema
 *
 * Stores third-party integration credentials and configuration for organizations.
 * Supports OAuth-based integrations (Google Calendar) and API-key based (Twilio, Stripe).
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ============================================================================
// INTEGRATION PROVIDER ENUM
// ============================================================================

/**
 * Supported integration providers
 */
export const integrationProviderEnum = pgEnum("integration_provider", [
  "stripe",
  "google-calendar",
  "mailchimp",
  "quickbooks",
  "zapier",
  "twilio",
  "whatsapp",
  "xero",
]);

// ============================================================================
// INTEGRATIONS TABLE
// ============================================================================

/**
 * Integrations table - Stores integration credentials and settings
 *
 * For OAuth-based integrations:
 * - accessToken and refreshToken are encrypted before storage
 * - tokenExpiresAt tracks when the access token expires
 *
 * For API-key based integrations (Twilio, etc.):
 * - accessToken stores the API key/token
 * - accountId stores account SID or similar identifier
 * - settings stores additional configuration (e.g., phone numbers)
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),

    // OAuth tokens (encrypted at application level)
    accessToken: text("access_token"), // Encrypted access token or API key
    refreshToken: text("refresh_token"), // Encrypted refresh token (OAuth only)
    tokenExpiresAt: timestamp("token_expires_at"), // When access token expires

    // Account identification
    accountId: text("account_id"), // External account ID (e.g., Google user ID, Twilio SID)
    accountName: text("account_name"), // Display name (e.g., email address, account name)
    accountEmail: text("account_email"), // Associated email address

    // Integration-specific settings
    settings: jsonb("settings").$type<{
      // Google Calendar settings
      calendarId?: string;
      syncEnabled?: boolean;
      syncDirection?: "one-way" | "two-way";

      // Twilio settings
      phoneNumber?: string;
      messagingServiceSid?: string;

      // WhatsApp settings
      whatsappPhoneNumberId?: string;

      // Stripe settings
      liveMode?: boolean;

      // Mailchimp settings
      listId?: string;
      audienceId?: string;

      // Zapier settings
      webhookUrl?: string;

      // QuickBooks/Xero settings
      companyId?: string;
      realmId?: string;

      // Generic settings
      [key: string]: unknown;
    }>(),

    // Scopes granted (OAuth)
    scopes: text("scopes"), // Space-separated list of granted scopes

    // Status
    isActive: boolean("is_active").notNull().default(true),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncError: text("last_sync_error"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Each org can only have one integration per provider
    uniqueIndex("integrations_org_provider_idx").on(table.organizationId, table.provider),
    index("integrations_org_idx").on(table.organizationId),
    index("integrations_provider_idx").on(table.provider),
    index("integrations_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// INTEGRATION SYNC LOG TABLE
// ============================================================================

/**
 * Integration sync log - Tracks sync operations for debugging
 */
export const integrationSyncLog = pgTable(
  "integration_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // sync, create, update, delete
    status: text("status").notNull().default("pending"), // pending, success, failed
    entityType: text("entity_type"), // trip, booking, customer, etc.
    entityId: text("entity_id"), // ID of the entity being synced
    externalId: text("external_id"), // ID in the external system
    details: jsonb("details").$type<{
      request?: unknown;
      response?: unknown;
      error?: string;
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("integration_sync_log_integration_idx").on(table.integrationId),
    index("integration_sync_log_status_idx").on(table.status),
    index("integration_sync_log_created_idx").on(table.createdAt),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

export type IntegrationSyncLog = typeof integrationSyncLog.$inferSelect;
export type NewIntegrationSyncLog = typeof integrationSyncLog.$inferInsert;

/**
 * Supported integration provider types
 */
export type IntegrationProvider =
  | "stripe"
  | "google-calendar"
  | "mailchimp"
  | "quickbooks"
  | "zapier"
  | "twilio"
  | "whatsapp"
  | "xero";

/**
 * Integration settings by provider
 */
export interface GoogleCalendarSettings {
  calendarId?: string;
  syncEnabled?: boolean;
  syncDirection?: "one-way" | "two-way";
}

export interface TwilioSettings {
  phoneNumber?: string;
  messagingServiceSid?: string;
}

export interface StripeSettings {
  liveMode?: boolean;
}

export interface MailchimpSettings {
  listId?: string;
  audienceId?: string;
}

export interface IntegrationDisplay {
  id: string;
  provider: IntegrationProvider;
  accountName: string | null;
  accountEmail: string | null;
  isActive: boolean;
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  settings: Record<string, unknown> | null;
}
