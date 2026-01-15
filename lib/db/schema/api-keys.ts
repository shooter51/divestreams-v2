/**
 * API Keys Schema
 *
 * API key management for external integrations.
 * Keys are hashed for security - the full key is only shown once at creation.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ============================================================================
// API KEYS TABLE
// ============================================================================

/**
 * API Keys table - Secure API key storage
 *
 * Keys are hashed using SHA-256 for secure storage.
 * Only the prefix is stored in plaintext for identification.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // User-friendly name for the key
    keyHash: text("key_hash").notNull(), // SHA-256 hash of the full key
    keyPrefix: text("key_prefix").notNull(), // First 12 chars for display (e.g., "dk_live_abc1")
    permissions: jsonb("permissions").$type<{
      read?: boolean;
      write?: boolean;
      delete?: boolean;
      scopes?: string[]; // e.g., ["bookings:read", "customers:write"]
    }>(),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("api_keys_org_idx").on(table.organizationId),
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

/**
 * API Key permissions structure
 */
export interface ApiKeyPermissions {
  read?: boolean;
  write?: boolean;
  delete?: boolean;
  scopes?: string[];
}

/**
 * API Key with display info (for listing keys)
 */
export interface ApiKeyDisplay {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: ApiKeyPermissions | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}
