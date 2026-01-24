import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/gallery/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as gallery from "../../../../../lib/db/gallery.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/gallery.server");

describe("app/routes/tenant/gallery/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("action", () => {
    it("should create album and redirect", async () => {
      const mockAlbum = {
        id: "album-123",
        name: "Great Barrier Reef 2024",
        slug: "great-barrier-reef-2024",
      };

      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Great Barrier Reef 2024");
      formData.append("description", "Amazing dive trip photos");
      formData.append("slug", "great-barrier-reef-2024");
      formData.append("sortOrder", "0");
      formData.append("isPublic", "true");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Great Barrier Reef 2024",
          description: "Amazing dive trip photos",
          slug: "great-barrier-reef-2024",
          sortOrder: 0,
          isPublic: true,
          coverImageUrl: null,
        })
      );

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/gallery/album-123");
    });

    it("should return validation error for missing name", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("slug", "fallback-slug"); // Provide slug to avoid null.toLowerCase() crash

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Album name is required");
    });

    it("should auto-generate slug from name if not provided", async () => {
      const mockAlbum = { id: "album-123", slug: "coral-sea-adventure" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Coral Sea Adventure");
      formData.append("description", "Dive expedition");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          slug: "coral-sea-adventure",
        })
      );
    });

    it("should handle optional fields correctly", async () => {
      const mockAlbum = { id: "album-123", slug: "simple-album" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Simple Album");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Simple Album",
          description: null,
          sortOrder: 0,
          isPublic: false,
          coverImageUrl: null,
        })
      );
    });

    it("should sanitize slug from name", async () => {
      const mockAlbum = { id: "album-123", slug: "amazing-dive-trip-2024" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Amazing Dive Trip! 2024");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          slug: "amazing-dive-trip-2024",
        })
      );
    });

    it("should handle custom slug", async () => {
      const mockAlbum = { id: "album-123", slug: "custom-slug-here" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Album Name");
      formData.append("slug", "custom-slug-here");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          slug: "custom-slug-here",
        })
      );
    });

    it("should parse sortOrder as number", async () => {
      const mockAlbum = { id: "album-123", slug: "sorted-album" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Sorted Album");
      formData.append("sortOrder", "5");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          sortOrder: 5,
        })
      );
    });

    it("should handle isPublic checkbox", async () => {
      const mockAlbum = { id: "album-123", slug: "public-album" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "Public Album");
      formData.append("isPublic", "true");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          isPublic: true,
        })
      );
    });

    it("should handle empty description as null", async () => {
      const mockAlbum = { id: "album-123", slug: "no-description" };
      vi.mocked(gallery.createGalleryAlbum).mockResolvedValue(mockAlbum as any);

      const formData = new FormData();
      formData.append("name", "No Description");
      formData.append("description", "");

      const request = new Request("http://test.com/app/gallery/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(gallery.createGalleryAlbum).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          description: null,
        })
      );
    });
  });
});
