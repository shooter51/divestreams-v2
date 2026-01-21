import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  integer,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";
import { trips } from "../schema";

// ============================================================================
// GALLERY ALBUMS
// ============================================================================

export const galleryAlbums = pgTable(
  "gallery_albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    coverImageUrl: text("cover_image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("gallery_albums_org_idx").on(table.organizationId),
    uniqueIndex("gallery_albums_org_slug_idx").on(table.organizationId, table.slug),
    index("gallery_albums_public_idx").on(table.organizationId, table.isPublic),
  ]
);

// ============================================================================
// GALLERY IMAGES
// ============================================================================

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    albumId: uuid("album_id").references(() => galleryAlbums.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    category: text("category"), // coral-reefs, marine-life, wrecks, team, customers, etc.
    tags: jsonb("tags").$type<string[]>().default([]),
    dateTaken: date("date_taken"),
    location: text("location"),
    photographer: text("photographer"),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: text("status").notNull().default("published"), // published, draft, archived
    metadata: jsonb("metadata").$type<{
      camera?: string;
      lens?: string;
      settings?: string;
      altText?: string;
      downloadable?: boolean;
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("gallery_images_org_idx").on(table.organizationId),
    index("gallery_images_album_idx").on(table.albumId),
    index("gallery_images_category_idx").on(table.organizationId, table.category),
    index("gallery_images_featured_idx").on(table.organizationId, table.isFeatured),
    index("gallery_images_status_idx").on(table.organizationId, table.status),
    index("gallery_images_trip_idx").on(table.tripId),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const galleryAlbumsRelations = relations(galleryAlbums, ({ one, many }) => ({
  organization: one(organization, {
    fields: [galleryAlbums.organizationId],
    references: [organization.id],
  }),
  images: many(galleryImages),
}));

export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  organization: one(organization, {
    fields: [galleryImages.organizationId],
    references: [organization.id],
  }),
  album: one(galleryAlbums, {
    fields: [galleryImages.albumId],
    references: [galleryAlbums.id],
  }),
  trip: one(trips, {
    fields: [galleryImages.tripId],
    references: [trips.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GalleryAlbum = typeof galleryAlbums.$inferSelect;
export type NewGalleryAlbum = typeof galleryAlbums.$inferInsert;

export type GalleryImage = typeof galleryImages.$inferSelect;
export type NewGalleryImage = typeof galleryImages.$inferInsert;
