/**
 * Public Site Gallery Page
 *
 * Displays photo and media gallery with:
 * - Responsive grid layout
 * - Lightbox/modal for full-size viewing
 * - Album/category filtering
 * - Tag filtering
 * - Search functionality
 */

import { useState, useEffect } from "react";
import { Link, useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import {
  getPublicGalleryImages,
  getPublicGalleryAlbums,
  getGalleryCategories,
  getGalleryTags,
  type GalleryImageWithAlbum,
  type GalleryAlbumWithImages,
} from "../../../lib/db/gallery.server";
import type { SiteLoaderData } from "./_layout";

// ============================================================================
// Types
// ============================================================================

interface GalleryLoaderData {
  images: GalleryImageWithAlbum[];
  albums: GalleryAlbumWithImages[];
  categories: string[];
  tags: string[];
  filters: {
    albumId?: string;
    category?: string;
    tags?: string[];
  };
}

// ============================================================================
// Loader
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<GalleryLoaderData> {
  const url = new URL(request.url);

  // Resolve organization ID from host
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  let org;
  if (subdomain) {
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);
  } else {
    const customDomain = host.split(":")[0];
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.customDomain, customDomain))
      .limit(1);
  }

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  const organizationId = org.id;

  // Get filter params
  const albumId = url.searchParams.get("album") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const tagParams = url.searchParams.get("tags");
  const tags = tagParams ? tagParams.split(",") : undefined;

  // Fetch gallery data
  const [images, albums, categories, allTags] = await Promise.all([
    getPublicGalleryImages(organizationId, { albumId, category, tags, limit: 100 }),
    getPublicGalleryAlbums(organizationId),
    getGalleryCategories(organizationId),
    getGalleryTags(organizationId),
  ]);

  return {
    images,
    albums,
    categories,
    tags: allTags,
    filters: { albumId, category, tags },
  };
}

// Helper function to extract subdomain
function getSubdomainFromHost(host: string): string | null {
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// Component
// ============================================================================

export default function GalleryPage() {
  const { images, albums, categories, tags, filters } = useLoaderData<typeof loader>();
  const siteData = useRouteLoaderData<SiteLoaderData>("routes/site/_layout");
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedImage, setSelectedImage] = useState<GalleryImageWithAlbum | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const siteName = siteData?.organization?.name || "Dive Shop";

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null);
      } else if (e.key === "ArrowLeft") {
        navigateLightbox(-1);
      } else if (e.key === "ArrowRight") {
        navigateLightbox(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, lightboxIndex, images]);

  const openLightbox = (image: GalleryImageWithAlbum, index: number) => {
    setSelectedImage(image);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const navigateLightbox = (direction: number) => {
    const newIndex = lightboxIndex + direction;
    if (newIndex >= 0 && newIndex < images.length) {
      setLightboxIndex(newIndex);
      setSelectedImage(images[newIndex]);
    }
  };

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = filters.albumId || filters.category || (filters.tags && filters.tags.length > 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background-color)" }}>
      {/* Hero Section */}
      <div className="text-white py-16" style={{ background: "linear-gradient(135deg, var(--primary-color), var(--secondary-color))" }}>
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Photo Gallery</h1>
          <p className="text-xl text-blue-100">
            Explore our underwater adventures and dive experiences
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Albums Section */}
        {albums.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-color)" }}>Albums</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => updateFilter("album", album.id)}
                  className={`group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300 ${
                    filters.albumId === album.id ? "ring-4 ring-blue-500" : ""
                  }`}
                >
                  <div className="aspect-w-16 aspect-h-9" style={{ backgroundColor: "var(--color-card-bg)", opacity: 0.5 }}>
                    {album.coverImageUrl ? (
                      <img
                        src={album.coverImageUrl}
                        alt={album.name}
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : album.images[0]?.thumbnailUrl || album.images[0]?.imageUrl ? (
                      <img
                        src={album.images[0].thumbnailUrl || album.images[0].imageUrl}
                        alt={album.name}
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                        <svg className="w-16 h-16 text-white opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end">
                    <div className="p-4 text-white text-left w-full">
                      <h3 className="text-lg font-semibold mb-1">{album.name}</h3>
                      <p className="text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                        {album.imageCount} {album.imageCount === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-lg shadow-md p-6 mb-8" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)", borderWidth: "1px" }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              {/* Category Filter */}
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-color)" }}>
                    Category
                  </label>
                  <select
                    value={filters.category || ""}
                    onChange={(e) => updateFilter("category", e.target.value || null)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag Filter */}
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-color)" }}>
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 8).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const currentTags = filters.tags || [];
                          const newTags = currentTags.includes(tag)
                            ? currentTags.filter(t => t !== tag)
                            : [...currentTags, tag];
                          updateFilter("tags", newTags.length > 0 ? newTags.join(",") : null);
                        }}
                        className="px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: filters.tags?.includes(tag) ? "var(--primary-color)" : "var(--color-card-bg)",
                          color: filters.tags?.includes(tag) ? "var(--color-primary-text)" : "var(--text-color)",
                          borderColor: "var(--color-border)",
                          borderWidth: "1px",
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>

        {/* Image Grid */}
        {images.length > 0 ? (
          <>
            <div className="mb-6">
              <p style={{ color: "var(--text-color)", opacity: 0.7 }}>
                Showing {images.length} {images.length === 1 ? "photo" : "photos"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => openLightbox(image, index)}
                  className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300"
                  style={{ backgroundColor: "var(--color-card-bg)" }}
                >
                  <div className="aspect-w-1 aspect-h-1">
                    <img
                      src={image.thumbnailUrl || image.imageUrl}
                      alt={image.title}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4 text-white text-left w-full">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">{image.title}</h3>
                      {image.location && (
                        <p className="text-xs line-clamp-1" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                          <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {image.location}
                        </p>
                      )}
                    </div>
                  </div>
                  {image.isFeatured && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Featured
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <svg className="mx-auto h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-color)", opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-color)" }}>No photos found</h3>
            <p className="mb-6" style={{ color: "var(--text-color)", opacity: 0.7 }}>
              {hasFilters
                ? "Try adjusting your filters to see more photos."
                : "Check back soon for our latest dive photos!"}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:opacity-80 z-10"
            aria-label="Close lightbox"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous Button */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:opacity-80 z-10"
              aria-label="Previous image"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Button */}
          {lightboxIndex < images.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:opacity-80 z-10"
              aria-label="Next image"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Image Container */}
          <div
            className="max-w-7xl max-h-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />

            {/* Image Info Panel */}
            <div className="bg-white/10 backdrop-blur-sm text-white p-6 rounded-lg mt-4 max-w-2xl">
              <h3 className="text-xl font-bold mb-2">{selectedImage.title}</h3>
              {selectedImage.description && (
                <p className="mb-4" style={{ color: "rgba(255, 255, 255, 0.9)" }}>{selectedImage.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedImage.location && (
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Location:</span>
                    <span className="ml-2">{selectedImage.location}</span>
                  </div>
                )}
                {selectedImage.photographer && (
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Photographer:</span>
                    <span className="ml-2">{selectedImage.photographer}</span>
                  </div>
                )}
                {selectedImage.dateTaken && (
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Date:</span>
                    <span className="ml-2">
                      {new Date(selectedImage.dateTaken).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedImage.album && (
                  <div>
                    <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Album:</span>
                    <span className="ml-2">{selectedImage.album.name}</span>
                  </div>
                )}
              </div>
              {selectedImage.tags && selectedImage.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedImage.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-white/20 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 text-xs text-gray-400">
                {lightboxIndex + 1} / {images.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
