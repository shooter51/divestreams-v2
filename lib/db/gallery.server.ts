/**
 * Gallery Server Functions
 *
 * Server-side functions for retrieving and managing gallery images and albums.
 */

import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  galleryImages,
  galleryAlbums,
  type GalleryImage,
  type GalleryAlbum,
  type NewGalleryImage,
  type NewGalleryAlbum,
} from "./schema/gallery";

// ============================================================================
// Types
// ============================================================================

export interface GalleryImageWithAlbum extends GalleryImage {
  album: GalleryAlbum | null;
}

export interface GalleryAlbumWithImages extends GalleryAlbum {
  images: GalleryImage[];
  imageCount: number;
}

export interface GalleryFilters {
  albumId?: string;
  category?: string;
  tags?: string[];
  featured?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Public Gallery Functions (for public site)
// ============================================================================

/**
 * Get all published images for an organization (public site)
 */
export async function getPublicGalleryImages(
  organizationId: string,
  filters: GalleryFilters = {}
): Promise<GalleryImageWithAlbum[]> {
  const {
    albumId,
    category,
    tags,
    featured,
    limit = 50,
    offset = 0,
  } = filters;

  let query = db
    .select({
      id: galleryImages.id,
      organizationId: galleryImages.organizationId,
      albumId: galleryImages.albumId,
      title: galleryImages.title,
      description: galleryImages.description,
      imageUrl: galleryImages.imageUrl,
      thumbnailUrl: galleryImages.thumbnailUrl,
      category: galleryImages.category,
      tags: galleryImages.tags,
      dateTaken: galleryImages.dateTaken,
      location: galleryImages.location,
      photographer: galleryImages.photographer,
      tripId: galleryImages.tripId,
      width: galleryImages.width,
      height: galleryImages.height,
      sortOrder: galleryImages.sortOrder,
      isFeatured: galleryImages.isFeatured,
      status: galleryImages.status,
      metadata: galleryImages.metadata,
      createdAt: galleryImages.createdAt,
      updatedAt: galleryImages.updatedAt,
      album: {
        id: galleryAlbums.id,
        organizationId: galleryAlbums.organizationId,
        name: galleryAlbums.name,
        description: galleryAlbums.description,
        slug: galleryAlbums.slug,
        coverImageUrl: galleryAlbums.coverImageUrl,
        sortOrder: galleryAlbums.sortOrder,
        isPublic: galleryAlbums.isPublic,
        createdAt: galleryAlbums.createdAt,
        updatedAt: galleryAlbums.updatedAt,
      },
    })
    .from(galleryImages)
    .leftJoin(galleryAlbums, eq(galleryImages.albumId, galleryAlbums.id))
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.status, "published"),
        albumId ? eq(galleryImages.albumId, albumId) : undefined,
        category ? eq(galleryImages.category, category) : undefined,
        featured !== undefined ? eq(galleryImages.isFeatured, featured) : undefined
      )
    )
    .orderBy(
      featured ? desc(galleryImages.isFeatured) : asc(galleryImages.sortOrder),
      desc(galleryImages.createdAt)
    )
    .limit(limit)
    .offset(offset);

  const results = await query;

  // Filter by tags if provided
  if (tags && tags.length > 0) {
    return results.filter((img) => {
      const imageTags = img.tags || [];
      return tags.some((tag) => imageTags.includes(tag));
    });
  }

  return results;
}

/**
 * Get a single published image by ID (public site)
 */
export async function getPublicGalleryImage(
  organizationId: string,
  imageId: string
): Promise<GalleryImageWithAlbum | null> {
  const [result] = await db
    .select({
      id: galleryImages.id,
      organizationId: galleryImages.organizationId,
      albumId: galleryImages.albumId,
      title: galleryImages.title,
      description: galleryImages.description,
      imageUrl: galleryImages.imageUrl,
      thumbnailUrl: galleryImages.thumbnailUrl,
      category: galleryImages.category,
      tags: galleryImages.tags,
      dateTaken: galleryImages.dateTaken,
      location: galleryImages.location,
      photographer: galleryImages.photographer,
      tripId: galleryImages.tripId,
      width: galleryImages.width,
      height: galleryImages.height,
      sortOrder: galleryImages.sortOrder,
      isFeatured: galleryImages.isFeatured,
      status: galleryImages.status,
      metadata: galleryImages.metadata,
      createdAt: galleryImages.createdAt,
      updatedAt: galleryImages.updatedAt,
      album: {
        id: galleryAlbums.id,
        organizationId: galleryAlbums.organizationId,
        name: galleryAlbums.name,
        description: galleryAlbums.description,
        slug: galleryAlbums.slug,
        coverImageUrl: galleryAlbums.coverImageUrl,
        sortOrder: galleryAlbums.sortOrder,
        isPublic: galleryAlbums.isPublic,
        createdAt: galleryAlbums.createdAt,
        updatedAt: galleryAlbums.updatedAt,
      },
    })
    .from(galleryImages)
    .leftJoin(galleryAlbums, eq(galleryImages.albumId, galleryAlbums.id))
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.id, imageId),
        eq(galleryImages.status, "published")
      )
    )
    .limit(1);

  return result || null;
}

/**
 * Get all public albums for an organization
 */
export async function getPublicGalleryAlbums(
  organizationId: string
): Promise<GalleryAlbumWithImages[]> {
  const albums = await db
    .select()
    .from(galleryAlbums)
    .where(
      and(
        eq(galleryAlbums.organizationId, organizationId),
        eq(galleryAlbums.isPublic, true)
      )
    )
    .orderBy(asc(galleryAlbums.sortOrder), asc(galleryAlbums.name));

  // Get image counts and sample images for each album
  const albumsWithImages = await Promise.all(
    albums.map(async (album) => {
      const images = await db
        .select()
        .from(galleryImages)
        .where(
          and(
            eq(galleryImages.albumId, album.id),
            eq(galleryImages.status, "published")
          )
        )
        .orderBy(asc(galleryImages.sortOrder))
        .limit(4);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(galleryImages)
        .where(
          and(
            eq(galleryImages.albumId, album.id),
            eq(galleryImages.status, "published")
          )
        );

      return {
        ...album,
        images,
        imageCount: countResult?.count || 0,
      };
    })
  );

  return albumsWithImages;
}

/**
 * Get a single public album with all images
 */
export async function getPublicGalleryAlbum(
  organizationId: string,
  albumSlug: string
): Promise<GalleryAlbumWithImages | null> {
  const [album] = await db
    .select()
    .from(galleryAlbums)
    .where(
      and(
        eq(galleryAlbums.organizationId, organizationId),
        eq(galleryAlbums.slug, albumSlug),
        eq(galleryAlbums.isPublic, true)
      )
    )
    .limit(1);

  if (!album) {
    return null;
  }

  const images = await db
    .select()
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.albumId, album.id),
        eq(galleryImages.status, "published")
      )
    )
    .orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt));

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.albumId, album.id),
        eq(galleryImages.status, "published")
      )
    );

  return {
    ...album,
    images,
    imageCount: countResult?.count || 0,
  };
}

/**
 * Get featured images for homepage or highlights
 */
export async function getFeaturedGalleryImages(
  organizationId: string,
  limit = 6
): Promise<GalleryImage[]> {
  return await db
    .select()
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.status, "published"),
        eq(galleryImages.isFeatured, true)
      )
    )
    .orderBy(asc(galleryImages.sortOrder), desc(galleryImages.createdAt))
    .limit(limit);
}

/**
 * Get all unique categories for an organization
 */
export async function getGalleryCategories(
  organizationId: string
): Promise<string[]> {
  const results = await db
    .selectDistinct({ category: galleryImages.category })
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.status, "published"),
        sql`${galleryImages.category} IS NOT NULL`
      )
    )
    .orderBy(asc(galleryImages.category));

  return results.map((r) => r.category).filter((c): c is string => c !== null);
}

/**
 * Get all unique tags for an organization
 */
export async function getGalleryTags(organizationId: string): Promise<string[]> {
  const images = await db
    .select({ tags: galleryImages.tags })
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.status, "published")
      )
    );

  const allTags = new Set<string>();
  images.forEach((img) => {
    const tags = img.tags || [];
    tags.forEach((tag) => allTags.add(tag));
  });

  return Array.from(allTags).sort();
}

// ============================================================================
// Admin Gallery Functions (for admin panel)
// ============================================================================

/**
 * Get all images for admin (includes drafts and archived)
 */
export async function getAllGalleryImages(
  organizationId: string,
  filters: GalleryFilters = {}
): Promise<GalleryImageWithAlbum[]> {
  const { albumId, category, status, limit = 100, offset = 0 } = filters;

  const results = await db
    .select({
      id: galleryImages.id,
      organizationId: galleryImages.organizationId,
      albumId: galleryImages.albumId,
      title: galleryImages.title,
      description: galleryImages.description,
      imageUrl: galleryImages.imageUrl,
      thumbnailUrl: galleryImages.thumbnailUrl,
      category: galleryImages.category,
      tags: galleryImages.tags,
      dateTaken: galleryImages.dateTaken,
      location: galleryImages.location,
      photographer: galleryImages.photographer,
      tripId: galleryImages.tripId,
      width: galleryImages.width,
      height: galleryImages.height,
      sortOrder: galleryImages.sortOrder,
      isFeatured: galleryImages.isFeatured,
      status: galleryImages.status,
      metadata: galleryImages.metadata,
      createdAt: galleryImages.createdAt,
      updatedAt: galleryImages.updatedAt,
      album: {
        id: galleryAlbums.id,
        organizationId: galleryAlbums.organizationId,
        name: galleryAlbums.name,
        description: galleryAlbums.description,
        slug: galleryAlbums.slug,
        coverImageUrl: galleryAlbums.coverImageUrl,
        sortOrder: galleryAlbums.sortOrder,
        isPublic: galleryAlbums.isPublic,
        createdAt: galleryAlbums.createdAt,
        updatedAt: galleryAlbums.updatedAt,
      },
    })
    .from(galleryImages)
    .leftJoin(galleryAlbums, eq(galleryImages.albumId, galleryAlbums.id))
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        albumId ? eq(galleryImages.albumId, albumId) : undefined,
        category ? eq(galleryImages.category, category) : undefined,
        status ? eq(galleryImages.status, status) : undefined
      )
    )
    .orderBy(desc(galleryImages.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get all albums for admin
 */
export async function getAllGalleryAlbums(
  organizationId: string
): Promise<GalleryAlbumWithImages[]> {
  const albums = await db
    .select()
    .from(galleryAlbums)
    .where(eq(galleryAlbums.organizationId, organizationId))
    .orderBy(asc(galleryAlbums.sortOrder), asc(galleryAlbums.name));

  const albumsWithImages = await Promise.all(
    albums.map(async (album) => {
      const images = await db
        .select()
        .from(galleryImages)
        .where(eq(galleryImages.albumId, album.id))
        .orderBy(asc(galleryImages.sortOrder))
        .limit(4);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(galleryImages)
        .where(eq(galleryImages.albumId, album.id));

      return {
        ...album,
        images,
        imageCount: countResult?.count || 0,
      };
    })
  );

  return albumsWithImages;
}

/**
 * Create a new gallery image
 */
export async function createGalleryImage(
  organizationId: string,
  data: Omit<NewGalleryImage, "organizationId">
): Promise<GalleryImage> {
  const [image] = await db
    .insert(galleryImages)
    .values({
      ...data,
      organizationId,
    })
    .returning();

  return image;
}

/**
 * Update a gallery image
 */
export async function updateGalleryImage(
  organizationId: string,
  imageId: string,
  data: Partial<Omit<NewGalleryImage, "organizationId">>
): Promise<GalleryImage | null> {
  const [image] = await db
    .update(galleryImages)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.id, imageId)
      )
    )
    .returning();

  return image || null;
}

/**
 * Delete a gallery image
 */
export async function deleteGalleryImage(
  organizationId: string,
  imageId: string
): Promise<boolean> {
  const result = await db
    .delete(galleryImages)
    .where(
      and(
        eq(galleryImages.organizationId, organizationId),
        eq(galleryImages.id, imageId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Create a new gallery album
 */
export async function createGalleryAlbum(
  organizationId: string,
  data: Omit<NewGalleryAlbum, "organizationId">
): Promise<GalleryAlbum> {
  const [album] = await db
    .insert(galleryAlbums)
    .values({
      ...data,
      organizationId,
    })
    .returning();

  return album;
}

/**
 * Update a gallery album
 */
export async function updateGalleryAlbum(
  organizationId: string,
  albumId: string,
  data: Partial<Omit<NewGalleryAlbum, "organizationId">>
): Promise<GalleryAlbum | null> {
  const [album] = await db
    .update(galleryAlbums)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(galleryAlbums.organizationId, organizationId),
        eq(galleryAlbums.id, albumId)
      )
    )
    .returning();

  return album || null;
}

/**
 * Delete a gallery album
 */
export async function deleteGalleryAlbum(
  organizationId: string,
  albumId: string
): Promise<boolean> {
  const result = await db
    .delete(galleryAlbums)
    .where(
      and(
        eq(galleryAlbums.organizationId, organizationId),
        eq(galleryAlbums.id, albumId)
      )
    )
    .returning();

  return result.length > 0;
}
