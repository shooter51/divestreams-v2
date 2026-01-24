import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/gallery/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as gallery from "../../../../../lib/db/gallery.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/gallery.server");
vi.mock("../../../../../lib/db/tenant.server");

describe.skip("app/routes/tenant/gallery/$id.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockAlbumId = "album-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch album with images", async () => {
      const mockAlbum = {
        id: mockAlbumId,
        name: "Great Barrier Reef 2024",
        description: "Amazing dive trip photos",
        slug: "great-barrier-reef-2024",
        coverImageUrl: "https://example.com/cover.jpg",
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-06-01"),
      };

      const mockImages = [
        {
          id: "img-1",
          url: "https://example.com/photo1.jpg",
          thumbnailUrl: "https://example.com/thumb1.jpg",
          filename: "photo1.jpg",
          width: 1920,
          height: 1080,
          alt: "Reef photo",
          sortOrder: 0,
          isPublic: true,
          isFeatured: true,
        },
        {
          id: "img-2",
          url: "https://example.com/photo2.jpg",
          thumbnailUrl: "https://example.com/thumb2.jpg",
          filename: "photo2.jpg",
          width: 1920,
          height: 1080,
          alt: "Coral photo",
          sortOrder: 1,
          isPublic: true,
          isFeatured: false,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAlbum]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { galleryAlbums: {} },
      } as any);

      vi.mocked(gallery.getAllGalleryImages).mockResolvedValue(mockImages as any);

      const request = new Request("http://test.com/tenant/gallery/album-456");
      const result = await loader({ request, params: { id: mockAlbumId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(gallery.getAllGalleryImages).toHaveBeenCalledWith(mockOrganizationId, {
        albumId: mockAlbumId,
      });
      expect(result.album.name).toBe("Great Barrier Reef 2024");
      expect(result.images).toHaveLength(2);
      expect(result.images[0].isFeatured).toBe(true);
      expect(result.images[1].isFeatured).toBe(false);
    });

    it("should throw 400 if album ID is missing", async () => {
      const request = new Request("http://test.com/tenant/gallery/");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Album ID required");
      }
    });

    it("should throw 404 if album not found", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { galleryAlbums: {} },
      } as any);

      const request = new Request("http://test.com/tenant/gallery/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Album not found");
      }
    });

    it("should handle albums with no images", async () => {
      const mockAlbum = {
        id: mockAlbumId,
        name: "Empty Album",
        slug: "empty-album",
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAlbum]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { galleryAlbums: {} },
      } as any);

      vi.mocked(gallery.getAllGalleryImages).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/gallery/album-456");
      const result = await loader({ request, params: { id: mockAlbumId }, context: {} });

      expect(result.images).toHaveLength(0);
    });

    it("should handle null optional fields", async () => {
      const mockAlbum = {
        id: mockAlbumId,
        name: "Minimal Album",
        description: null,
        coverImageUrl: null,
        slug: "minimal-album",
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockAlbum]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { galleryAlbums: {} },
      } as any);

      vi.mocked(gallery.getAllGalleryImages).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/gallery/album-456");
      const result = await loader({ request, params: { id: mockAlbumId }, context: {} });

      expect(result.album.description).toBeNull();
      expect(result.album.coverImageUrl).toBeNull();
    });
  });

  describe("action", () => {
    it("should update album", async () => {
      vi.mocked(gallery.updateGalleryAlbum).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "update-album");
      formData.append("name", "Updated Album Name");
      formData.append("description", "Updated description");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(gallery.updateGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        mockAlbumId,
        expect.objectContaining({
          name: "Updated Album Name",
          description: "Updated description",
        })
      );
      expect(result).toEqual({ updated: true });
    });

    it("should delete album and redirect", async () => {
      vi.mocked(gallery.deleteGalleryAlbum).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete-album");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(gallery.deleteGalleryAlbum).toHaveBeenCalledWith(mockOrganizationId, mockAlbumId);
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/gallery");
    });

    it("should delete image", async () => {
      vi.mocked(gallery.deleteGalleryImage).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete-image");
      formData.append("imageId", "img-123");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(gallery.deleteGalleryImage).toHaveBeenCalledWith(mockOrganizationId, "img-123");
      expect(result).toEqual({ imageDeleted: true });
    });

    it("should update image status", async () => {
      vi.mocked(gallery.updateGalleryImage).mockResolvedValue({} as any);

      const formData = new FormData();
      formData.append("intent", "update-image-status");
      formData.append("imageId", "img-123");
      formData.append("status", "published");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(gallery.updateGalleryImage).toHaveBeenCalledWith(
        mockOrganizationId,
        "img-123",
        { status: "published" }
      );
      expect(result).toEqual({ statusUpdated: true });
    });

    it("should set featured image", async () => {
      vi.mocked(gallery.updateGalleryImage).mockResolvedValue({} as any);

      const formData = new FormData();
      formData.append("intent", "set-featured");
      formData.append("imageId", "img-123");
      formData.append("isFeatured", "true");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(gallery.updateGalleryImage).toHaveBeenCalledWith(
        mockOrganizationId,
        "img-123",
        { isFeatured: true }
      );
      expect(result).toEqual({ featuredUpdated: true });
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/gallery/album-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockAlbumId }, context: {} });

      expect(result).toBeNull();
    });

    it("should return error if album ID is missing in action", async () => {
      const formData = new FormData();
      formData.append("intent", "update-album");

      const request = new Request("http://test.com/tenant/gallery/", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({ error: "Album ID required" });
    });
  });
});
