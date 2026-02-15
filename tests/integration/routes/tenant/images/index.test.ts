import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader } from "../../../../../app/routes/tenant/images/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/tenant.server");

describe("app/routes/tenant/images/index.tsx", () => {
  const mockTenant = { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      tenant: mockTenant,
      organizationId: "org-123",
    } as any);
  });

  describe("loader", () => {
    it("should fetch images for an entity", async () => {
      const mockImages = [
        {
          id: "img-1",
          url: "https://cdn.divestreams.com/tour/123/photo1.webp",
          thumbnailUrl: "https://cdn.divestreams.com/tour/123/photo1-thumb.webp",
          filename: "photo1.jpg",
          width: 1920,
          height: 1080,
          alt: "Reef photo",
          sortOrder: 0,
          isPrimary: true,
        },
        {
          id: "img-2",
          url: "https://cdn.divestreams.com/tour/123/photo2.webp",
          thumbnailUrl: "https://cdn.divestreams.com/tour/123/photo2-thumb.webp",
          filename: "photo2.jpg",
          width: 1920,
          height: 1080,
          alt: "Coral photo",
          sortOrder: 1,
          isPrimary: false,
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockImages),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images?entityType=tour&entityId=123");
      const result = await loader({ request, params: {}, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockTenant.subdomain);

      const json = await result.json();
      expect(json.images).toHaveLength(2);
      expect(json.images[0].isPrimary).toBe(true);
      expect(json.images[1].isPrimary).toBe(false);
    });

    it("should return 400 if entityType is missing", async () => {
      const request = new Request("http://test.com/tenant/images?entityId=123");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType and entityId are required");
    });

    it("should return 400 if entityId is missing", async () => {
      const request = new Request("http://test.com/tenant/images?entityType=tour");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("entityType and entityId are required");
    });

    it("should return empty array if no images exist", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images?entityType=tour&entityId=456");
      const result = await loader({ request, params: {}, context: {} });

      const json = await result.json();
      expect(json.images).toHaveLength(0);
    });

    it("should handle different entity types", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/images?entityType=boat&entityId=789");
      const result = await loader({ request, params: {}, context: {} });

      const json = await result.json();
      expect(json.images).toBeDefined();
    });
  });
});
