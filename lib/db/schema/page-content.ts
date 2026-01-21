import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";

// ============================================================================
// CONTENT BLOCK TYPES
// ============================================================================

/**
 * Content block types supported by the page builder
 */
export type ContentBlockType =
  | "heading"
  | "paragraph"
  | "html"
  | "image"
  | "gallery"
  | "team-section"
  | "values-grid"
  | "cta"
  | "divider"
  | "spacer";

/**
 * Base content block interface
 */
export interface BaseContentBlock {
  id: string;
  type: ContentBlockType;
}

/**
 * Heading block
 */
export interface HeadingBlock extends BaseContentBlock {
  type: "heading";
  content: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Paragraph block
 */
export interface ParagraphBlock extends BaseContentBlock {
  type: "paragraph";
  content: string; // HTML from rich text editor
}

/**
 * HTML block for custom content
 */
export interface HtmlBlock extends BaseContentBlock {
  type: "html";
  content: string;
}

/**
 * Image block
 */
export interface ImageBlock extends BaseContentBlock {
  type: "image";
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Gallery block
 */
export interface GalleryBlock extends BaseContentBlock {
  type: "gallery";
  images: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  columns?: 2 | 3 | 4;
}

/**
 * Team member for team section
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  image?: string;
  bio?: string;
  certifications?: string[];
}

/**
 * Team section block
 */
export interface TeamSectionBlock extends BaseContentBlock {
  type: "team-section";
  title?: string;
  description?: string;
  members: TeamMember[];
}

/**
 * Value item for values grid
 */
export interface ValueItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

/**
 * Values grid block
 */
export interface ValuesGridBlock extends BaseContentBlock {
  type: "values-grid";
  title?: string;
  values: ValueItem[];
  columns?: 2 | 3 | 4;
}

/**
 * Call-to-action block
 */
export interface CtaBlock extends BaseContentBlock {
  type: "cta";
  title: string;
  description?: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor?: string;
}

/**
 * Divider block
 */
export interface DividerBlock extends BaseContentBlock {
  type: "divider";
  style?: "solid" | "dashed" | "dotted";
}

/**
 * Spacer block for vertical spacing
 */
export interface SpacerBlock extends BaseContentBlock {
  type: "spacer";
  height: number; // in pixels
}

/**
 * Union type of all content blocks
 */
export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | HtmlBlock
  | ImageBlock
  | GalleryBlock
  | TeamSectionBlock
  | ValuesGridBlock
  | CtaBlock
  | DividerBlock
  | SpacerBlock;

/**
 * Page content structure
 */
export interface PageContent {
  blocks: ContentBlock[];
}

// ============================================================================
// PAGE CONTENT TABLE
// ============================================================================

/**
 * Pages table for CMS content
 * Stores editable page content with version history
 */
export const pageContent = pgTable(
  "page_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Page identification
    pageId: text("page_id").notNull(), // e.g., "about", "home", "contact"
    pageName: text("page_name").notNull(), // e.g., "About Us", "Home Page"

    // Content
    content: jsonb("content").$type<PageContent>().notNull(),

    // SEO fields
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),

    // Publishing
    status: text("status").notNull().default("draft"), // draft, published, archived
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at"),
    publishedBy: text("published_by"), // user ID

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: text("created_by").notNull(), // user ID
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(), // user ID
  },
  (table) => [
    index("page_content_org_idx").on(table.organizationId),
    uniqueIndex("page_content_org_page_idx").on(table.organizationId, table.pageId),
    index("page_content_status_idx").on(table.organizationId, table.status),
    index("page_content_published_idx").on(table.organizationId, table.publishedAt),
  ]
);

// ============================================================================
// PAGE CONTENT HISTORY
// ============================================================================

/**
 * Page content history for versioning
 * Keeps track of all changes made to pages
 */
export const pageContentHistory = pgTable(
  "page_content_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageContentId: uuid("page_content_id")
      .notNull()
      .references(() => pageContent.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Version info
    version: integer("version").notNull(),
    content: jsonb("content").$type<PageContent>().notNull(),

    // Metadata
    changeDescription: text("change_description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: text("created_by").notNull(), // user ID
  },
  (table) => [
    index("page_history_page_idx").on(table.pageContentId),
    index("page_history_org_idx").on(table.organizationId),
    index("page_history_version_idx").on(table.pageContentId, table.version),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const pageContentRelations = relations(pageContent, ({ one, many }) => ({
  organization: one(organization, {
    fields: [pageContent.organizationId],
    references: [organization.id],
  }),
  history: many(pageContentHistory),
}));

export const pageContentHistoryRelations = relations(
  pageContentHistory,
  ({ one }) => ({
    page: one(pageContent, {
      fields: [pageContentHistory.pageContentId],
      references: [pageContent.id],
    }),
    organization: one(organization, {
      fields: [pageContentHistory.organizationId],
      references: [organization.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PageContentRow = typeof pageContent.$inferSelect;
export type NewPageContent = typeof pageContent.$inferInsert;

export type PageContentHistoryRow = typeof pageContentHistory.$inferSelect;
export type NewPageContentHistory = typeof pageContentHistory.$inferInsert;
