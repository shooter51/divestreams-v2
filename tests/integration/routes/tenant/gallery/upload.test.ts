/**
 * Integration test for gallery image upload route
 * Tests /tenant/gallery/upload endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/gallery/upload";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(() =>
    Promise.resolve({
      org: { id: "test-org-id", name: "Test Shop", slug: "test", createdAt: new Date() },
      user: { id: "user-1", email: "owner@example.com", name: "Owner" },
      session: { id: "session-1" },
      membership: { id: "member-1", role: "owner" },
      subscription: null,
      limits: {
        customers: 50, bookingsPerMonth: 100, tours: 10, teamMembers: 1,
        hasPOS: false, hasEquipmentRentals: true, hasAdvancedReports: false, hasEmailNotifications: false,
      },
      usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
      canAddCustomer: true, canAddTour: true, canAddBooking: true, isPremium: false,
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
  getS3Client: vi.fn(() => ({ config: {} })), // Mock S3Client as configured
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
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations that may have been changed by previous tests
    const { isValidImageType, uploadToB2, getS3Client } = await import("../../../../../lib/storage");
    vi.mocked(isValidImageType).mockImplementation((type: string) => type.startsWith("image/"));
    vi.mocked(uploadToB2).mockImplementation((key: string, buffer: Buffer, mimeType: string) =>
      Promise.resolve({
        cdnUrl: `https://cdn.example.com/${key}`,
        key,
      })
    );
    vi.mocked(getS3Client).mockReturnValue({ config: {} } as any);
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

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/tenant/gallery/test-album-id");
    expect(location).toContain("success=Successfully+uploaded+1+image");
  });

  it("should reject request without file", async () => {
    const formData = new FormData();
    formData.append("albumId", "test-album-id");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/tenant/gallery/test-album-id");
    expect(location).toContain("error=No+files+selected");
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

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/tenant/gallery/test-album-id");
    expect(location).toContain("error=All");
  });

  it("should handle missing B2 configuration", async () => {
    const { getS3Client } = await import("../../../../../lib/storage");
    vi.mocked(getS3Client).mockReturnValueOnce(null);

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

    expect(response.status).toBe(302); // Redirect
    const location = response.headers.get("Location");
    expect(location).toContain("/tenant/gallery/test-album-id");
    expect(location).toContain("error=Image+storage+is+not+configured");
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

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/tenant/gallery");
    expect(location).toContain("success=Successfully+uploaded");

    expect(createGalleryImage).toHaveBeenCalledWith(
      "test-org-id",
      expect.objectContaining({
        albumId: null,
      })
    );
  });
});
