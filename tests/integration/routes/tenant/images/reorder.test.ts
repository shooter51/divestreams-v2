import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { action } from "../../../../../app/routes/tenant/images/reorder";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/tenant.server");

describe("app/routes/tenant/images/reorder.tsx", () => {
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
      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "GET",
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(405);
      const json = await result.json();
      expect(json.error).toBe("Method not allowed");
    });

    it("should return 400 if required fields are missing", async () => {
      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "tour" }), // Missing entityId and images
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType, entityId, and images array are required");
    });

    it("should return 400 if images is not an array", async () => {
      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "tour",
          entityId: "123",
          images: "not-an-array",
        }),
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType, entityId, and images array are required");
    });

    it("should return 400 if images do not belong to entity", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: "img-1" }]), // Only 1 image found, but 2 requested
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "tour",
          entityId: "123",
          images: [
            { id: "img-1", sortOrder: 0, isPrimary: true },
            { id: "img-2", sortOrder: 1, isPrimary: false },
          ],
        }),
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("One or more images do not belong to this entity");
    });

    it("should reorder images and update primary status", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      let updateCallCount = 0;
      const mockUpdateFn = vi.fn().mockImplementation(() => {
        updateCallCount++;
        return mockUpdateBuilder;
      });

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          update: mockUpdateFn,
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "tour",
          entityId: "123",
          images: [
            { id: "img-2", sortOrder: 0, isPrimary: true },
            { id: "img-1", sortOrder: 1, isPrimary: false },
            { id: "img-3", sortOrder: 2, isPrimary: false },
          ],
        }),
      });

      const result = await action({ request, params: {}, context: {} });

      // First update: reset all isPrimary to false
      expect(mockUpdateFn).toHaveBeenCalled();
      // Then 3 more updates: one for each image
      expect(updateCallCount).toBeGreaterThan(3);

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.success).toBe(true);
    });

    it("should handle reorder without isPrimary field", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: "img-1" }, { id: "img-2" }]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          update: vi.fn().mockReturnValue(mockUpdateBuilder),
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "tour",
          entityId: "123",
          images: [
            { id: "img-1", sortOrder: 0 },
            { id: "img-2", sortOrder: 1 },
          ],
        }),
      });

      const result = await action({ request, params: {}, context: {} });

      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        sortOrder: expect.any(Number),
        isPrimary: false,
      });

      const json = await result.json();
      expect(json.success).toBe(true);
    });

    it("should handle different entity types", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: "img-1" }]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          update: vi.fn().mockReturnValue(mockUpdateBuilder),
        },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "boat",
          entityId: "456",
          images: [{ id: "img-1", sortOrder: 0, isPrimary: true }],
        }),
      });

      const result = await action({ request, params: {}, context: {} });

      const json = await result.json();
      expect(json.success).toBe(true);
    });
  });
});
