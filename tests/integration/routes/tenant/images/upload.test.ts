import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/images/upload";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";
import * as storage from "../../../../../lib/storage";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/tenant.server");
vi.mock("../../../../../lib/storage");

describe("app/routes/tenant/images/upload.tsx", () => {
  const mockTenant = { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: mockTenant,
      organizationId: "org-123",
    } as any);
  });

  describe("action", () => {
    it("should return 405 for non-POST requests", async () => {
      const request = new Request("http://test.com/tenant/images/upload", {
        method: "GET",
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(405);
      const json = await result.json();
      expect(json.error).toBe("Method not allowed");
    });

    it("should return 400 if file is missing", async () => {
      const formData = new FormData();
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("No file provided");
    });

    it("should return 400 if entityType is missing", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityId", "123");

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType and entityId are required");
    });

    it("should return 400 if entityId is missing", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType and entityId are required");
    });

    it("should return 400 for invalid entity type", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "invalid");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toContain("Invalid entityType");
    });

    it("should return 400 for invalid file type", async () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(false);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toContain("Invalid file type");
    });

    it("should return 400 if file is too large", async () => {
      // Create a large file buffer (11MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toContain("File too large");
    });

    it("should return 400 if max images limit reached", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 5 }]), // Already at max
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toContain("Maximum 5 images allowed");
    });

    it("should return 500 if upload fails", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);
      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 1920,
        height: 1080,
      });
      vi.mocked(storage.getImageKey).mockReturnValue("test/tour/123/test.jpg");
      vi.mocked(storage.getWebPMimeType).mockReturnValue("image/webp");
      vi.mocked(storage.uploadToB2).mockResolvedValue(null); // Upload failed

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(500);
      const json = await result.json();
      expect(json.error).toContain("Failed to upload image");
    });

    it("should successfully upload image", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");
      formData.append("alt", "Test photo");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);
      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 1920,
        height: 1080,
      });
      vi.mocked(storage.getImageKey).mockReturnValue("test/tour/123/test.jpg");
      vi.mocked(storage.getWebPMimeType).mockReturnValue("image/webp");
      vi.mocked(storage.uploadToB2).mockResolvedValue({
        cdnUrl: "https://cdn.divestreams.com/test/tour/123/test.webp",
        b2Url: "https://s3.backblazeb2.com/test/tour/123/test.webp",
      });

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "img-123",
            url: "https://cdn.divestreams.com/test/tour/123/test.webp",
            thumbnailUrl: "https://cdn.divestreams.com/test/tour/123/test-thumb.webp",
            filename: "test.jpg",
            width: 1920,
            height: 1080,
            alt: "Test photo",
            sortOrder: 0,
            isPrimary: true,
          },
        ]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(storage.processImage).toHaveBeenCalled();
      expect(storage.uploadToB2).toHaveBeenCalledTimes(2); // Original + thumbnail

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.success).toBe(true);
      expect(json.image.id).toBe("img-123");
      expect(json.image.isPrimary).toBe(true);
    });

    it("should set first image as primary", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);
      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 1920,
        height: 1080,
      });
      vi.mocked(storage.getImageKey).mockReturnValue("test/tour/123/test.jpg");
      vi.mocked(storage.getWebPMimeType).mockReturnValue("image/webp");
      vi.mocked(storage.uploadToB2).mockResolvedValue({
        cdnUrl: "https://cdn.divestreams.com/test/tour/123/test.webp",
        b2Url: "https://s3.backblazeb2.com/test/tour/123/test.webp",
      });

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]), // First image
      };

      const mockInsertBuilder = {
        values: vi.fn((data) => {
          expect(data.isPrimary).toBe(true); // First image should be primary
          return mockInsertBuilder;
        }),
        returning: vi.fn().mockResolvedValue([
          {
            id: "img-123",
            url: "https://cdn.divestreams.com/test/tour/123/test.webp",
            thumbnailUrl: "https://cdn.divestreams.com/test/tour/123/test-thumb.webp",
            filename: "test.jpg",
            width: 1920,
            height: 1080,
            alt: "test.jpg",
            sortOrder: 0,
            isPrimary: true,
          },
        ]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(mockInsertBuilder.values).toHaveBeenCalled();
    });

    it("should not set non-first image as primary", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "123");

      vi.mocked(storage.isValidImageType).mockReturnValue(true);
      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 1920,
        height: 1080,
      });
      vi.mocked(storage.getImageKey).mockReturnValue("test/tour/123/test.jpg");
      vi.mocked(storage.getWebPMimeType).mockReturnValue("image/webp");
      vi.mocked(storage.uploadToB2).mockResolvedValue({
        cdnUrl: "https://cdn.divestreams.com/test/tour/123/test.webp",
        b2Url: "https://s3.backblazeb2.com/test/tour/123/test.webp",
      });

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 2 }]), // Third image
      };

      const mockInsertBuilder = {
        values: vi.fn((data) => {
          expect(data.isPrimary).toBe(false); // Not first image
          return mockInsertBuilder;
        }),
        returning: vi.fn().mockResolvedValue([
          {
            id: "img-123",
            url: "https://cdn.divestreams.com/test/tour/123/test.webp",
            thumbnailUrl: "https://cdn.divestreams.com/test/tour/123/test-thumb.webp",
            filename: "test.jpg",
            width: 1920,
            height: 1080,
            alt: "test.jpg",
            sortOrder: 2,
            isPrimary: false,
          },
        ]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(mockInsertBuilder.values).toHaveBeenCalled();
    });
  });
});
