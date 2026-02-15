import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader } from "../../../../../app/routes/tenant/gallery/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as gallery from "../../../../../lib/db/gallery.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/gallery.server");

describe("app/routes/tenant/gallery/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch all gallery albums", async () => {
      const mockAlbums = [
        {
          id: "album-1",
          name: "Great Barrier Reef 2024",
          description: "Amazing dive trip photos",
          slug: "great-barrier-reef-2024",
          coverImageUrl: "https://example.com/cover.jpg",
          imageCount: 25,
          sortOrder: 0,
          isPublic: true,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-06-01"),
        },
        {
          id: "album-2",
          name: "Coral Sea Adventure",
          description: "Coral diving expedition",
          slug: "coral-sea-adventure",
          coverImageUrl: null,
          imageCount: 18,
          sortOrder: 1,
          isPublic: false,
          createdAt: new Date("2024-02-20"),
          updatedAt: new Date("2024-02-20"),
        },
      ];

      vi.mocked(gallery.getAllGalleryAlbums).mockResolvedValue(mockAlbums as any);

      const request = new Request("http://test.com/tenant/gallery");
      const result = await loader({ request, params: {}, context: {} });

      expect(gallery.getAllGalleryAlbums).toHaveBeenCalledWith(mockOrganizationId);
      expect(result.albums).toHaveLength(2);
      expect(result.albums[0].name).toBe("Great Barrier Reef 2024");
      expect(result.albums[0].imageCount).toBe(25);
      expect(result.albums[1].name).toBe("Coral Sea Adventure");
      expect(result.albums[1].imageCount).toBe(18);
    });

    it("should handle empty albums list", async () => {
      vi.mocked(gallery.getAllGalleryAlbums).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/gallery");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.albums).toHaveLength(0);
    });

    it("should handle albums with null cover images", async () => {
      const mockAlbums = [
        {
          id: "album-1",
          name: "New Album",
          slug: "new-album",
          coverImageUrl: null,
          imageCount: 0,
          isPublic: true,
        },
      ];

      vi.mocked(gallery.getAllGalleryAlbums).mockResolvedValue(mockAlbums as any);

      const request = new Request("http://test.com/tenant/gallery");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.albums[0].coverImageUrl).toBeNull();
      expect(result.albums[0].imageCount).toBe(0);
    });

    it("should handle public and private albums", async () => {
      const mockAlbums = [
        { id: "album-1", name: "Public Album", isPublic: true, imageCount: 10 },
        { id: "album-2", name: "Private Album", isPublic: false, imageCount: 5 },
      ];

      vi.mocked(gallery.getAllGalleryAlbums).mockResolvedValue(mockAlbums as any);

      const request = new Request("http://test.com/tenant/gallery");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.albums[0].isPublic).toBe(true);
      expect(result.albums[1].isPublic).toBe(false);
    });
  });
});
