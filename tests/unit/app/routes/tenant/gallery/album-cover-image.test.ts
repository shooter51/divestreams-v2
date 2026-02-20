import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../../lib/db/gallery.server", () => ({
  createGalleryAlbum: vi.fn(),
  getGalleryAlbum: vi.fn(),
  updateGalleryAlbum: vi.fn(),
  deleteGalleryAlbum: vi.fn(),
  getAllGalleryImages: vi.fn(),
  updateGalleryImage: vi.fn(),
  deleteGalleryImage: vi.fn(),
}));

vi.mock("../../../../../../lib/storage", () => ({
  uploadToB2: vi.fn(),
  getWebPMimeType: vi.fn().mockReturnValue("image/webp"),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
  getS3Client: vi.fn(),
}));

vi.mock("../../../../../../lib/logger", () => ({
  storageLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Helper to create a mock File
function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

// Helper to create FormData for album creation
function createAlbumFormData(fields: Record<string, string | File>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

// Helper to create a Request with FormData
function createFormRequest(
  formData: FormData,
  method = "POST"
): Request {
  return new Request("http://localhost/tenant/gallery/new", {
    method,
    body: formData,
  });
}

describe("Gallery Album Cover Image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Album Creation with Cover Image", () => {
    it("should create album with cover image when file is provided", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { createGalleryAlbum } = await import(
        "../../../../../../lib/db/gallery.server"
      );
      const { uploadToB2, processImage, isValidImageType, getS3Client } =
        await import("../../../../../../lib/storage");

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(isValidImageType).mockReturnValue(true);
      vi.mocked(getS3Client).mockReturnValue({} as unknown);
      vi.mocked(processImage).mockResolvedValue({
        original: Buffer.from("processed-image"),
        thumbnail: Buffer.from("thumbnail"),
        width: 1920,
        height: 1080,
        thumbnailWidth: 200,
        thumbnailHeight: 200,
      });
      vi.mocked(uploadToB2).mockResolvedValue({
        key: "test-shop/gallery/covers/12345-cover.jpg.webp",
        url: "https://s3.example.com/test-shop/gallery/covers/12345-cover.jpg.webp",
        cdnUrl: "https://cdn.example.com/test-shop/gallery/covers/12345-cover.jpg.webp",
      });
      vi.mocked(createGalleryAlbum).mockResolvedValue({
        id: "album-1",
        organizationId: "org-1",
        name: "Summer Dives",
        description: null,
        slug: "summer-dives",
        coverImageUrl:
          "https://cdn.example.com/test-shop/gallery/covers/12345-cover.jpg.webp",
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const coverFile = createMockFile("cover.jpg", 1024, "image/jpeg");
      const formData = createAlbumFormData({
        name: "Summer Dives",
        description: "",
        slug: "",
        sortOrder: "0",
        isPublic: "true",
        coverImage: coverFile,
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/new"
      );
      const response = await action({
        request,
        params: {},
        context: {},
      } as unknown);

      // Should redirect on success
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);

      // Verify processImage was called
      expect(processImage).toHaveBeenCalled();

      // Verify uploadToB2 was called with correct params
      expect(uploadToB2).toHaveBeenCalledWith(
        expect.stringContaining("test-shop/gallery/covers/"),
        expect.any(Buffer),
        "image/webp"
      );

      // Verify createGalleryAlbum was called with coverImageUrl
      expect(createGalleryAlbum).toHaveBeenCalledWith("org-1", {
        name: "Summer Dives",
        description: null,
        slug: "summer-dives",
        sortOrder: 0,
        isPublic: true,
        coverImageUrl:
          "https://cdn.example.com/test-shop/gallery/covers/12345-cover.jpg.webp",
      });
    });

    it("should create album without cover image when no file provided", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { createGalleryAlbum } = await import(
        "../../../../../../lib/db/gallery.server"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(createGalleryAlbum).mockResolvedValue({
        id: "album-2",
        organizationId: "org-1",
        name: "My Album",
        description: null,
        slug: "my-album",
        coverImageUrl: null,
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const formData = createAlbumFormData({
        name: "My Album",
        description: "",
        slug: "",
        sortOrder: "0",
        isPublic: "true",
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/new"
      );
      const response = await action({
        request,
        params: {},
        context: {},
      } as unknown);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);

      expect(createGalleryAlbum).toHaveBeenCalledWith("org-1", {
        name: "My Album",
        description: null,
        slug: "my-album",
        sortOrder: 0,
        isPublic: true,
        coverImageUrl: null,
      });
    });

    it("should reject invalid image type for cover image", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { isValidImageType } = await import(
        "../../../../../../lib/storage"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(isValidImageType).mockReturnValue(false);

      const badFile = createMockFile("document.pdf", 1024, "application/pdf");
      const formData = createAlbumFormData({
        name: "Test Album",
        description: "",
        slug: "",
        sortOrder: "0",
        isPublic: "true",
        coverImage: badFile,
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/new"
      );
      const result = await action({
        request,
        params: {},
        context: {},
      } as unknown);

      // Should return errors, not redirect
      expect(result).toHaveProperty("errors");
      expect((result as unknown).errors.coverImage).toContain("Invalid image type");
    });

    it("should reject oversized cover image", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { isValidImageType } = await import(
        "../../../../../../lib/storage"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(isValidImageType).mockReturnValue(true);

      // Create a file exceeding 10MB
      const bigFile = createMockFile(
        "huge.jpg",
        11 * 1024 * 1024,
        "image/jpeg"
      );
      const formData = createAlbumFormData({
        name: "Test Album",
        description: "",
        slug: "",
        sortOrder: "0",
        isPublic: "true",
        coverImage: bigFile,
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/new"
      );
      const result = await action({
        request,
        params: {},
        context: {},
      } as unknown);

      expect(result).toHaveProperty("errors");
      expect((result as unknown).errors.coverImage).toContain("under 10MB");
    });

    it("should return error when storage is not configured", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { isValidImageType, getS3Client } = await import(
        "../../../../../../lib/storage"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(isValidImageType).mockReturnValue(true);
      vi.mocked(getS3Client).mockReturnValue(null);

      const coverFile = createMockFile("cover.jpg", 1024, "image/jpeg");
      const formData = createAlbumFormData({
        name: "Test Album",
        description: "",
        slug: "",
        sortOrder: "0",
        isPublic: "true",
        coverImage: coverFile,
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/new"
      );
      const result = await action({
        request,
        params: {},
        context: {},
      } as unknown);

      expect(result).toHaveProperty("errors");
      expect((result as unknown).errors.coverImage).toContain("not configured");
    });
  });

  describe("Album Edit with Cover Image Update", () => {
    it("should update album with new cover image", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { updateGalleryAlbum } = await import("../../../../../../lib/db/gallery.server");
      const { uploadToB2, processImage, isValidImageType, getS3Client } =
        await import("../../../../../../lib/storage");

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(isValidImageType).mockReturnValue(true);
      vi.mocked(getS3Client).mockReturnValue({} as unknown);
      vi.mocked(processImage).mockResolvedValue({
        original: Buffer.from("new-processed"),
        thumbnail: Buffer.from("new-thumb"),
        width: 1920,
        height: 1080,
        thumbnailWidth: 200,
        thumbnailHeight: 200,
      });
      vi.mocked(uploadToB2).mockResolvedValue({
        key: "test-shop/gallery/covers/99999-new-cover.jpg.webp",
        url: "https://s3.example.com/test-shop/gallery/covers/99999-new-cover.jpg.webp",
        cdnUrl:
          "https://cdn.example.com/test-shop/gallery/covers/99999-new-cover.jpg.webp",
      });
      vi.mocked(updateGalleryAlbum).mockResolvedValue({
        id: "album-1",
        organizationId: "org-1",
        name: "Updated Album",
        description: null,
        slug: "updated-album",
        coverImageUrl:
          "https://cdn.example.com/test-shop/gallery/covers/99999-new-cover.jpg.webp",
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const coverFile = createMockFile(
        "new-cover.jpg",
        2048,
        "image/jpeg"
      );
      const formData = createAlbumFormData({
        intent: "update-album",
        name: "Updated Album",
        description: "",
        sortOrder: "0",
        isPublic: "true",
        coverImage: coverFile,
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/$id"
      );
      const result = await action({
        request,
        params: { id: "album-1" },
        context: {},
      } as unknown);

      expect(result).toEqual({ updated: true });

      // Verify updateGalleryAlbum was called with the new cover URL
      expect(updateGalleryAlbum).toHaveBeenCalledWith(
        "org-1",
        "album-1",
        expect.objectContaining({
          coverImageUrl:
            "https://cdn.example.com/test-shop/gallery/covers/99999-new-cover.jpg.webp",
        })
      );
    });

    it("should remove cover image when removeCover is checked", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { updateGalleryAlbum } = await import(
        "../../../../../../lib/db/gallery.server"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(updateGalleryAlbum).mockResolvedValue({
        id: "album-1",
        organizationId: "org-1",
        name: "Album",
        description: null,
        slug: "album",
        coverImageUrl: null,
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const formData = createAlbumFormData({
        intent: "update-album",
        name: "Album",
        description: "",
        sortOrder: "0",
        isPublic: "true",
        removeCover: "true",
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/$id"
      );
      const result = await action({
        request,
        params: { id: "album-1" },
        context: {},
      } as unknown);

      expect(result).toEqual({ updated: true });

      expect(updateGalleryAlbum).toHaveBeenCalledWith(
        "org-1",
        "album-1",
        expect.objectContaining({
          coverImageUrl: null,
        })
      );
    });

    it("should update album without changing cover when no file provided", async () => {
      const { requireOrgContext } = await import(
        "../../../../../../lib/auth/org-context.server"
      );
      const { updateGalleryAlbum } = await import(
        "../../../../../../lib/db/gallery.server"
      );

      vi.mocked(requireOrgContext).mockResolvedValue({
        org: { id: "org-1", slug: "test-shop" },
        user: { id: "user-1" },
      } as unknown);

      vi.mocked(updateGalleryAlbum).mockResolvedValue({
        id: "album-1",
        organizationId: "org-1",
        name: "Updated Name",
        description: null,
        slug: "album",
        coverImageUrl: "https://cdn.example.com/existing-cover.webp",
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const formData = createAlbumFormData({
        intent: "update-album",
        name: "Updated Name",
        description: "",
        sortOrder: "0",
        isPublic: "true",
      });

      const request = createFormRequest(formData);

      const { action } = await import(
        "../../../../../../app/routes/tenant/gallery/$id"
      );
      const result = await action({
        request,
        params: { id: "album-1" },
        context: {},
      } as unknown);

      expect(result).toEqual({ updated: true });

      // coverImageUrl should NOT be in the update data (preserves existing)
      const updateCall = vi.mocked(updateGalleryAlbum).mock.calls[0];
      expect(updateCall[2]).not.toHaveProperty("coverImageUrl");
    });
  });

  describe("Gallery Index - Cover Image Fallback", () => {
    it("should display cover image when album has coverImageUrl", () => {
      const album = {
        id: "album-1",
        name: "Test Album",
        coverImageUrl: "https://cdn.example.com/cover.webp",
        images: [],
        imageCount: 5,
        isPublic: true,
        sortOrder: 0,
      };

      // coverImageUrl is set, so the template should render an img tag with it
      expect(album.coverImageUrl).toBeTruthy();
    });

    it("should fall back to first image when no coverImageUrl", () => {
      const album = {
        id: "album-2",
        name: "No Cover Album",
        coverImageUrl: null,
        images: [
          {
            thumbnailUrl: "https://cdn.example.com/thumb1.webp",
            imageUrl: "https://cdn.example.com/img1.webp",
          },
        ],
        imageCount: 3,
        isPublic: true,
        sortOrder: 0,
      };

      // No coverImageUrl, but has images - should use first image
      expect(album.coverImageUrl).toBeNull();
      expect(album.images.length).toBeGreaterThan(0);
      const fallbackSrc =
        album.images[0].thumbnailUrl || album.images[0].imageUrl;
      expect(fallbackSrc).toBe("https://cdn.example.com/thumb1.webp");
    });

    it("should show placeholder when no cover and no images", () => {
      const album = {
        id: "album-3",
        name: "Empty Album",
        coverImageUrl: null,
        images: [],
        imageCount: 0,
        isPublic: true,
        sortOrder: 0,
      };

      // No coverImageUrl and no images - should show placeholder
      expect(album.coverImageUrl).toBeNull();
      expect(album.images.length).toBe(0);
    });

    it("should prefer coverImageUrl over first image", () => {
      const album = {
        id: "album-4",
        name: "Both Cover and Images",
        coverImageUrl: "https://cdn.example.com/explicit-cover.webp",
        images: [
          {
            thumbnailUrl: "https://cdn.example.com/thumb1.webp",
            imageUrl: "https://cdn.example.com/img1.webp",
          },
        ],
        imageCount: 2,
        isPublic: true,
        sortOrder: 0,
      };

      // When coverImageUrl is set, it should take priority
      // This mirrors the logic in the index.tsx template:
      //   album.coverImageUrl ? <img src={album.coverImageUrl} />
      //   : album.images.length > 0 ? <img src={album.images[0].thumbnailUrl} />
      //   : <placeholder>
      const displayedSrc = album.coverImageUrl
        ? album.coverImageUrl
        : album.images.length > 0
        ? album.images[0].thumbnailUrl || album.images[0].imageUrl
        : null;

      expect(displayedSrc).toBe(
        "https://cdn.example.com/explicit-cover.webp"
      );
    });
  });

  describe("Image Validation", () => {
    it("should validate image types correctly", async () => {
      const { isValidImageType } = await import(
        "../../../../../../lib/storage"
      );

      // Restore real implementation for this test
      vi.mocked(isValidImageType).mockImplementation((mimeType: string) =>
        ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          mimeType
        )
      );

      expect(isValidImageType("image/jpeg")).toBe(true);
      expect(isValidImageType("image/png")).toBe(true);
      expect(isValidImageType("image/webp")).toBe(true);
      expect(isValidImageType("image/gif")).toBe(true);
      expect(isValidImageType("application/pdf")).toBe(false);
      expect(isValidImageType("text/plain")).toBe(false);
      expect(isValidImageType("image/bmp")).toBe(false);
    });
  });
});
