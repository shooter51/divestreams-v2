import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ============================================================================
// CONTENT TRANSLATIONS
// ============================================================================

export const contentTranslations = pgTable(
  "content_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // "tour", "course", "product", "page", "trip"
    entityId: text("entity_id").notNull(),
    locale: text("locale").notNull(), // e.g. "es"
    field: text("field").notNull(), // e.g. "name", "description", "shortDescription"
    value: text("value").notNull(),
    source: text("source").notNull().default("auto"), // "auto" or "manual"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("content_translations_org_idx").on(table.organizationId),
    index("content_translations_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId
    ),
    index("content_translations_locale_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.locale
    ),
    uniqueIndex("content_translations_unique_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.locale,
      table.field
    ),
  ]
);

export type ContentTranslation = typeof contentTranslations.$inferSelect;
export type NewContentTranslation = typeof contentTranslations.$inferInsert;
