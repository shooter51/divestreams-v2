/**
 * QuickBooks Sync Schema
 *
 * Stores mappings between DiveStreams entities and QuickBooks entities.
 * Tracks sync status for customers, invoices, and payments.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { integrations } from "./integrations";

// ============================================================================
// ENTITY TYPE ENUM
// ============================================================================

/**
 * Types of entities that can be synced with QuickBooks
 */
export const quickbooksSyncEntityEnum = pgEnum("quickbooks_sync_entity", [
  "customer",
  "invoice",
  "payment",
  "item",
]);

// ============================================================================
// SYNC STATUS ENUM
// ============================================================================

/**
 * Sync status for entities
 */
export const quickbooksSyncStatusEnum = pgEnum("quickbooks_sync_status", [
  "pending",
  "synced",
  "failed",
  "deleted",
]);

// ============================================================================
// QUICKBOOKS SYNC RECORDS TABLE
// ============================================================================

/**
 * QuickBooks sync records - Maps DiveStreams entities to QuickBooks entities
 *
 * This table tracks which DiveStreams entities (customers, invoices, payments)
 * have been synced to QuickBooks and maintains the mapping between IDs.
 */
export const quickbooksSyncRecords = pgTable(
  "quickbooks_sync_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Entity identification
    entityType: quickbooksSyncEntityEnum("entity_type").notNull(),
    divestreamsId: text("divestreams_id").notNull(), // ID in DiveStreams (booking, customer, payment ID)
    quickbooksId: text("quickbooks_id").notNull(), // ID in QuickBooks

    // Sync tracking
    syncStatus: quickbooksSyncStatusEnum("sync_status")
      .notNull()
      .default("synced"),
    lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
    lastSyncError: text("last_sync_error"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Each DiveStreams entity can only have one QuickBooks mapping per org
    index("qb_sync_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.divestreamsId
    ),
    index("qb_sync_integration_idx").on(table.integrationId),
    index("qb_sync_status_idx").on(table.syncStatus),
    index("qb_sync_quickbooks_id_idx").on(table.quickbooksId),
  ]
);

// ============================================================================
// QUICKBOOKS ITEM MAPPINGS TABLE
// ============================================================================

/**
 * QuickBooks item mappings - Maps DiveStreams products/services to QuickBooks items
 *
 * This table allows users to configure which DiveStreams trip types, courses,
 * or products map to which QuickBooks items for invoice line items.
 */
export const quickbooksItemMappings = pgTable(
  "quickbooks_item_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // DiveStreams product identification
    divestreamsProductType: text("divestreams_product_type").notNull(), // "trip", "course", "rental", "product"
    divestreamsProductId: text("divestreams_product_id"), // Specific ID or null for default mapping

    // QuickBooks item mapping
    quickbooksItemId: text("quickbooks_item_id").notNull(),
    quickbooksItemName: text("quickbooks_item_name").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("qb_mapping_org_idx").on(table.organizationId),
    index("qb_mapping_integration_idx").on(table.integrationId),
    index("qb_mapping_product_idx").on(
      table.organizationId,
      table.divestreamsProductType,
      table.divestreamsProductId
    ),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type QuickBooksSyncRecord = typeof quickbooksSyncRecords.$inferSelect;
export type NewQuickBooksSyncRecord = typeof quickbooksSyncRecords.$inferInsert;

export type QuickBooksItemMapping = typeof quickbooksItemMappings.$inferSelect;
export type NewQuickBooksItemMapping = typeof quickbooksItemMappings.$inferInsert;

/**
 * QuickBooks entity types
 */
export type QuickBooksEntityType = "customer" | "invoice" | "payment" | "item";

/**
 * QuickBooks sync status
 */
export type QuickBooksSyncStatus = "pending" | "synced" | "failed" | "deleted";
