import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/images/delete";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";
import * as storage from "../../../../../lib/storage";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/tenant.server");
vi.mock("../../../../../lib/storage");

describe("app/routes/tenant/images/delete.tsx", () => {
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
      const request = new Request("http://test.com/tenant/images/delete", {
        method: "GET",
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(405);
      const json = await result.json();
      expect(json.error).toBe("Method not allowed");
    });

    it("should return 400 if imageId is missing", async () => {
      const formData = new FormData();

      const request = new Request("http://test.com/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("imageId is required");
    });

    it("should return 404 if image not found", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const formData = new FormData();
      formData.append("imageId", "nonexistent");

      const request = new Request("http://test.com/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(404);
      const json = await result.json();
      expect(json.error).toBe("Image not found");
    });

    it("should delete image and storage files", async () => {
      const mockImage = {
        id: "img-123",
        url: "https://cdn.divestreams.com/test/tour/123/photo.webp",
        thumbnailUrl: "https://cdn.divestreams.com/test/tour/123/photo-thumb.webp",
        isPrimary: false,
        entityType: "tour",
        entityId: "123",
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockImage]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          delete: vi.fn().mockReturnValue(mockDeleteBuilder),
        },
        schema: { images: {} },
      } as any);

      vi.mocked(storage.deleteFromB2).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("imageId", "img-123");

      const request = new Request("http://test.com/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(storage.deleteFromB2).toHaveBeenCalledTimes(2); // Original + thumbnail
      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.success).toBe(true);
    });

    it("should set new primary when deleting primary image", async () => {
      const mockImage = {
        id: "img-123",
        url: "https://cdn.divestreams.com/test/tour/123/photo.webp",
        thumbnailUrl: "https://cdn.divestreams.com/test/tour/123/photo-thumb.webp",
        isPrimary: true,
        entityType: "tour",
        entityId: "123",
      };

      const mockNextImage = {
        id: "img-456",
        sortOrder: 1,
      };

      let selectCallCount = 0;
      const mockSelectFn = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First select: find the image
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([mockImage]),
          };
        } else {
          // Second select: find next image
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockNextImage]),
          };
        }
      });

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: mockSelectFn,
          delete: vi.fn().mockReturnValue(mockDeleteBuilder),
          update: vi.fn().mockReturnValue(mockUpdateBuilder),
        },
        schema: { images: {} },
      } as any);

      vi.mocked(storage.deleteFromB2).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("imageId", "img-123");

      const request = new Request("http://test.com/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({ isPrimary: true });
      const json = await result.json();
      expect(json.success).toBe(true);
    });

    it("should handle storage deletion errors gracefully", async () => {
      const mockImage = {
        id: "img-123",
        url: "invalid-url",
        thumbnailUrl: null,
        isPrimary: false,
        entityType: "tour",
        entityId: "123",
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockImage]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          delete: vi.fn().mockReturnValue(mockDeleteBuilder),
        },
        schema: { images: {} },
      } as any);

      vi.mocked(storage.deleteFromB2).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("imageId", "img-123");

      const request = new Request("http://test.com/tenant/images/delete", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      const json = await result.json();
      expect(json.success).toBe(true);
    });
  });
});
