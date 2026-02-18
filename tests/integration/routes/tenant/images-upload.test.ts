import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

vi.mock("../../../../lib/storage", () => ({
  uploadToB2: vi.fn(),
  getImageKey: vi.fn((tenant, entityType, entityId, filename) =>
    `${tenant}/${entityType}/${entityId}/${filename}`
  ),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
}));

vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  count: vi.fn(() => "count"),
}));

import { action } from "../../../../app/routes/tenant/images/upload";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { uploadToB2, processImage, isValidImageType } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";

describe("tenant/images/upload route", () => {
  const mockTenantContext = {
    tenant: {
      id: "tenant-1",
      subdomain: "demo",
      schemaName: "tenant_demo",
      name: "Demo Dive Shop",
      subscriptionStatus: "active",
      trialEndsAt: null,
    },
    organizationId: "org-uuid-123",
  };

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  const mockSchema = {
    images: {
      id: "id",
      entityType: "entityType",
      entityId: "entityId",
      organizationId: "organizationId",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireTenant as Mock).mockResolvedValue(mockTenantContext);
    (getTenantDb as Mock).mockReturnValue({ db: mockDb, schema: mockSchema });
    (isValidImageType as Mock).mockReturnValue(true);
    (processImage as Mock).mockResolvedValue({
      original: Buffer.from("processed"),
      thumbnail: Buffer.from("thumb"),
      width: 800,
      height: 600,
    });
    mockDb.where.mockResolvedValue([{ count: 0 }]);
  });

  describe("action", () => {
    it("rejects non-POST requests", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "GET",
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe("Method not allowed");
    });

    it("requires tenant context", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      (uploadToB2 as Mock).mockResolvedValue({
        cdnUrl: "https://cdn.example.com/image.webp",
      });
      mockDb.returning.mockResolvedValue([{
        id: "img-1",
        url: "https://cdn.example.com/image.webp",
        thumbnailUrl: "https://cdn.example.com/thumb.webp",
        filename: "test.jpg",
        width: 800,
        height: 600,
        alt: "test.jpg",
        sortOrder: 0,
        isPrimary: true,
      }]);

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(requireTenant).toHaveBeenCalled();
    });

    it("returns error when no file provided", async () => {
      const formData = new FormData();
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No file provided");
    });

    it("returns error when entityType missing", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.jpg");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("entityType and entityId are required");
    });

    it("returns error when entityId missing", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.jpg");
      formData.append("entityType", "tour");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("entityType and entityId are required");
    });

    it("returns error for invalid entityType", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.jpg");
      formData.append("entityType", "invalid");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid entityType");
    });

    it("accepts valid entity types", async () => {
      const validTypes = ["tour", "dive-site", "boat", "equipment", "staff"];

      for (const entityType of validTypes) {
        vi.clearAllMocks();
        (requireTenant as Mock).mockResolvedValue(mockTenantContext);
        (getTenantDb as Mock).mockReturnValue({ db: mockDb, schema: mockSchema });
        (isValidImageType as Mock).mockReturnValue(true);
        (processImage as Mock).mockResolvedValue({
          original: Buffer.from("processed"),
          thumbnail: Buffer.from("thumb"),
          width: 800,
          height: 600,
        });
        mockDb.where.mockResolvedValue([{ count: 0 }]);
        (uploadToB2 as Mock).mockResolvedValue({ cdnUrl: "https://cdn.example.com/image.webp" });
        mockDb.returning.mockResolvedValue([{
          id: "img-1",
          url: "https://cdn.example.com/image.webp",
          thumbnailUrl: "https://cdn.example.com/image.webp",
          filename: "test.jpg",
          width: 800,
          height: 600,
          alt: "test.jpg",
          sortOrder: 0,
          isPrimary: true,
        }]);

        const formData = new FormData();
        formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
        formData.append("entityType", entityType);
        formData.append("entityId", "entity-123");

        const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(response.status).not.toBe(400);
      }
    });

    it("returns error for invalid file type", async () => {
      (isValidImageType as Mock).mockReturnValue(false);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid file type");
    });

    it("returns error when file too large", async () => {
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill("a").join("");
      const largeFile = new Blob([largeContent], { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", largeFile, "large.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("too large");
    });

    it("returns error when max images reached", async () => {
      mockDb.where.mockResolvedValue([{ count: 5 }]); // MAX_IMAGES_PER_ENTITY = 5

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Maximum 5 images allowed");
    });

    it("returns error when B2 upload fails", async () => {
      (uploadToB2 as Mock).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain("Image storage is not configured");
    });

    it("uploads image successfully", async () => {
      (uploadToB2 as Mock).mockResolvedValue({
        cdnUrl: "https://cdn.example.com/demo/tour/tour-123/test.webp",
      });
      mockDb.returning.mockResolvedValue([{
        id: "img-1",
        url: "https://cdn.example.com/demo/tour/tour-123/test.webp",
        thumbnailUrl: "https://cdn.example.com/demo/tour/tour-123/test-thumb.webp",
        filename: "test.jpg",
        width: 800,
        height: 600,
        alt: "test.jpg",
        sortOrder: 0,
        isPrimary: true,
      }]);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.image).toMatchObject({
        id: "img-1",
        url: "https://cdn.example.com/demo/tour/tour-123/test.webp",
        filename: "test.jpg",
        width: 800,
        height: 600,
      });
    });

    it("uses custom alt text when provided", async () => {
      (uploadToB2 as Mock).mockResolvedValue({ cdnUrl: "https://cdn.example.com/image.webp" });
      mockDb.returning.mockResolvedValue([{
        id: "img-1",
        url: "https://cdn.example.com/image.webp",
        thumbnailUrl: "https://cdn.example.com/thumb.webp",
        filename: "test.jpg",
        width: 800,
        height: 600,
        alt: "Coral reef at sunrise",
        sortOrder: 0,
        isPrimary: true,
      }]);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");
      formData.append("alt", "Coral reef at sunrise");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(data.image.alt).toBe("Coral reef at sunrise");
    });

    it("sets first image as primary", async () => {
      mockDb.where.mockResolvedValue([{ count: 0 }]); // First image

      (uploadToB2 as Mock).mockResolvedValue({ cdnUrl: "https://cdn.example.com/image.webp" });
      mockDb.returning.mockResolvedValue([{
        id: "img-1",
        url: "https://cdn.example.com/image.webp",
        thumbnailUrl: "https://cdn.example.com/thumb.webp",
        filename: "test.jpg",
        width: 800,
        height: 600,
        alt: "test.jpg",
        sortOrder: 0,
        isPrimary: true,
      }]);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(data.image.isPrimary).toBe(true);
      expect(data.image.sortOrder).toBe(0);
    });

    it("handles processing errors gracefully", async () => {
      (processImage as Mock).mockRejectedValue(new Error("Processing failed"));

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const request = new Request("https://demo.divestreams.com/tenant/images/upload", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to upload image");
    });
  });
});
