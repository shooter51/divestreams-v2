/**
 * Site Gallery Route Tests
 *
 * Tests the gallery page loader with organization resolution, filters, and data fetching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/site/gallery";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock gallery functions
vi.mock("../../../../lib/db/gallery.server", () => ({
  getPublicGalleryImages: vi.fn(),
  getPublicGalleryAlbums: vi.fn(),
  getGalleryCategories: vi.fn(),
  getGalleryTags: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../lib/db";
import {
  getPublicGalleryImages,
  getPublicGalleryAlbums,
  getGalleryCategories,
  getGalleryTags,
} from "../../../../lib/db/gallery.server";

describe("Route: site/gallery.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
  };

  const mockImages = [
    {
      id: "img-1",
      title: "Coral Reef",
      imageUrl: "https://example.com/image1.jpg",
      thumbnailUrl: "https://example.com/thumb1.jpg",
      location: "Great Barrier Reef",
      isFeatured: true,
    },
    {
      id: "img-2",
      title: "Sea Turtle",
      imageUrl: "https://example.com/image2.jpg",
      thumbnailUrl: "https://example.com/thumb2.jpg",
      location: "Maldives",
      isFeatured: false,
    },
  ];

  const mockAlbums = [
    {
      id: "album-1",
      name: "Summer Dives 2024",
      coverImageUrl: "https://example.com/album1.jpg",
      imageCount: 10,
      images: [],
    },
    {
      id: "album-2",
      name: "Wrecks and Caves",
      coverImageUrl: "https://example.com/album2.jpg",
      imageCount: 8,
      images: [],
    },
  ];

  const mockCategories = ["marine-life", "wrecks", "coral-reefs"];
  const mockTags = ["underwater", "colorful", "adventure", "beginner-friendly"];

  describe("loader", () => {
    it("should throw 404 when organization not found by subdomain", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load gallery data without filters", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: undefined,
        category: undefined,
        tags: undefined,
        limit: 100,
      });
      expect(getPublicGalleryAlbums).toHaveBeenCalledWith("org-123");
      expect(getGalleryCategories).toHaveBeenCalledWith("org-123");
      expect(getGalleryTags).toHaveBeenCalledWith("org-123");
      expect(result).toEqual({
        images: mockImages,
        albums: mockAlbums,
        categories: mockCategories,
        tags: mockTags,
        filters: {
          albumId: undefined,
          category: undefined,
          tags: undefined,
        },
      });
    });

    it("should load gallery data with album filter", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery?album=album-1");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: "album-1",
        category: undefined,
        tags: undefined,
        limit: 100,
      });
      expect(result.filters).toEqual({
        albumId: "album-1",
        category: undefined,
        tags: undefined,
      });
    });

    it("should load gallery data with category filter", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery?category=marine-life");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: undefined,
        category: "marine-life",
        tags: undefined,
        limit: 100,
      });
      expect(result.filters).toEqual({
        albumId: undefined,
        category: "marine-life",
        tags: undefined,
      });
    });

    it("should load gallery data with single tag filter", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery?tags=underwater");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: undefined,
        category: undefined,
        tags: ["underwater"],
        limit: 100,
      });
      expect(result.filters).toEqual({
        albumId: undefined,
        category: undefined,
        tags: ["underwater"],
      });
    });

    it("should load gallery data with multiple tag filters", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery?tags=underwater,colorful,adventure");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: undefined,
        category: undefined,
        tags: ["underwater", "colorful", "adventure"],
        limit: 100,
      });
      expect(result.filters).toEqual({
        albumId: undefined,
        category: undefined,
        tags: ["underwater", "colorful", "adventure"],
      });
    });

    it("should load gallery data with all filters combined", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery?album=album-1&category=marine-life&tags=underwater,colorful");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-123", {
        albumId: "album-1",
        category: "marine-life",
        tags: ["underwater", "colorful"],
        limit: 100,
      });
      expect(result.filters).toEqual({
        albumId: "album-1",
        category: "marine-life",
        tags: ["underwater", "colorful"],
      });
    });

    it("should resolve organization by subdomain", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.images).toEqual(mockImages);
      expect(result.albums).toEqual(mockAlbums);
      expect(result.categories).toEqual(mockCategories);
      expect(result.tags).toEqual(mockTags);
    });

    it("should return empty images array when no images found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue([]);
      (getPublicGalleryAlbums as any).mockResolvedValue(mockAlbums);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.images).toEqual([]);
      expect(result.albums).toEqual(mockAlbums);
    });

    it("should return empty albums array when no albums found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/gallery");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getPublicGalleryImages as any).mockResolvedValue(mockImages);
      (getPublicGalleryAlbums as any).mockResolvedValue([]);
      (getGalleryCategories as any).mockResolvedValue(mockCategories);
      (getGalleryTags as any).mockResolvedValue(mockTags);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.images).toEqual(mockImages);
      expect(result.albums).toEqual([]);
    });
  });
});
