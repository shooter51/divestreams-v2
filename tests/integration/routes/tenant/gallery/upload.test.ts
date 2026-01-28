/**
 * Integration test for gallery image upload route
 * Tests /tenant/gallery/upload endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/gallery/upload";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(() =>
    Promise.resolve({
      tenant: { id: "test-tenant", subdomain: "test" },
      organizationId: "test-org-id",
    })
  ),
}));

vi.mock("../../../../../lib/storage", () => ({
  uploadToB2: vi.fn((key: string, buffer: Buffer, mimeType: string) =>
    Promise.resolve({
      cdnUrl: `https://cdn.example.com/${key}`,
      key,
    })
  ),
  getImageKey: vi.fn((subdomain, type, id, filename) => `${subdomain}/${type}/${id}/${filename}`),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn((buffer: Buffer) =>
    Promise.resolve({
      original: buffer,
      thumbnail: buffer,
      width: 800,
      height: 600,
    })
  ),
  isValidImageType: vi.fn((type: string) => type.startsWith("image/")),
}));

vi.mock("../../../../../lib/db/gallery.server", () => ({
  createGalleryImage: vi.fn((orgId, data) =>
    Promise.resolve({
      id: "test-image-id",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  ),
}));

describe("Gallery Upload Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload gallery image successfully", async () => {
    const formData = new FormData();
    const file = new File(["test image data"], "test-image.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);
    formData.append("albumId", "test-album-id");
    formData.append("title", "Test Image");
    formData.append("description", "Test description");
    formData.append("category", "coral-reefs");
    formData.append("tags", "diving, reef, underwater");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.image).toBeDefined();
    expect(result.image.id).toBe("test-image-id");
    expect(result.image.title).toBe("Test Image");
  });

  it("should reject request without file", async () => {
    const formData = new FormData();
    formData.append("albumId", "test-album-id");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe("No file provided");
  });

  it("should reject invalid file type", async () => {
    const { isValidImageType } = await import("../../../../../lib/storage");
    vi.mocked(isValidImageType).mockReturnValue(false);

    const formData = new FormData();
    const file = new File(["test data"], "test.txt", {
      type: "text/plain",
    });
    formData.append("file", file);
    formData.append("albumId", "test-album-id");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toContain("Invalid file type");
  });

  it("should handle missing B2 configuration", async () => {
    const { uploadToB2 } = await import("../../../../../lib/storage");
    vi.mocked(uploadToB2).mockResolvedValueOnce(null);

    const formData = new FormData();
    // Create file with realistic size
    const buffer = new Uint8Array(1024); // 1KB
    const file = new File([buffer], "test-image.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);
    formData.append("albumId", "test-album-id");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result.error).toContain("storage is not configured");
  });

  it("should parse tags correctly", async () => {
    const { createGalleryImage } = await import("../../../../../lib/db/gallery.server");

    const formData = new FormData();
    const buffer = new Uint8Array(1024);
    const file = new File([buffer], "test-image.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);
    formData.append("tags", "diving, reef, underwater");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    await action({ request, params: {}, context: {} } as any);

    expect(createGalleryImage).toHaveBeenCalledWith(
      "test-org-id",
      expect.objectContaining({
        tags: ["diving", "reef", "underwater"],
      })
    );
  });

  it("should handle upload without albumId", async () => {
    const { createGalleryImage } = await import("../../../../../lib/db/gallery.server");

    const formData = new FormData();
    const buffer = new Uint8Array(1024);
    const file = new File([buffer], "test-image.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);
    formData.append("title", "Uncategorized Image");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(createGalleryImage).toHaveBeenCalledWith(
      "test-org-id",
      expect.objectContaining({
        albumId: null,
      })
    );
  });
});
