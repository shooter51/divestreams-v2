import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/dive-sites/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";
import * as validation from "../../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");
vi.mock("../../../../../../lib/validation");

describe("app/routes/tenant/dive-sites/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockSiteId = "site-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as any);
  });

  describe("loader", () => {
    it("should fetch dive site for editing", async () => {
      const mockSite = {
        id: mockSiteId,
        name: "Blue Corner",
        description: "Famous drift dive",
        maxDepth: "30",
        difficulty: "intermediate",
        latitude: "7.165",
        longitude: "134.271",
        visibility: "15-25m",
        currentStrength: "moderate",
        highlights: ["Sharks", "Coral Wall"],
        isActive: true,
      };

      const mockImages = [
        {
          id: "img-1",
          url: "https://example.com/image.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          filename: "image.jpg",
          width: 1920,
          height: 1080,
          alt: "Dive site photo",
          sortOrder: 0,
          isPrimary: true,
        },
      ];

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockImages),
      };

      const mockSchema = {
        images: {
          id: Symbol("id"),
          url: Symbol("url"),
          thumbnailUrl: Symbol("thumbnailUrl"),
          filename: Symbol("filename"),
          width: Symbol("width"),
          height: Symbol("height"),
          alt: Symbol("alt"),
          sortOrder: Symbol("sortOrder"),
          isPrimary: Symbol("isPrimary"),
          organizationId: Symbol("organizationId"),
          entityType: Symbol("entityType"),
          entityId: Symbol("entityId"),
        },
      };

      const mockDb = { select: vi.fn().mockReturnValue(mockSelectBuilder) };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as any);

      const request = new Request("http://test.com/tenant/dive-sites/site-456/edit");
      const result = await loader({ request, params: { id: mockSiteId }, context: {} });

      expect(queries.getDiveSiteById).toHaveBeenCalledWith(mockOrganizationId, mockSiteId);
      expect(result.site.id).toBe(mockSiteId);
      expect(result.site.name).toBe("Blue Corner");
      expect(result.images).toHaveLength(1);
    });

    it("should throw 400 if site ID is missing", async () => {
      const request = new Request("http://test.com/tenant/dive-sites//edit");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Dive Site ID required");
      }
    });

    it("should throw 404 if site not found", async () => {
      vi.mocked(queries.getDiveSiteById).mockResolvedValue(null);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/dive-sites/nonexistent/edit");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Dive site not found");
      }
    });

    it("should handle null optional fields", async () => {
      const mockSite = {
        id: mockSiteId,
        name: "Minimal Site",
        description: null,
        maxDepth: null,
        difficulty: null,
        latitude: null,
        longitude: null,
        visibility: null,
        currentStrength: null,
        highlights: null,
        isActive: true,
      };

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/dive-sites/site-456/edit");
      const result = await loader({ request, params: { id: mockSiteId }, context: {} });

      expect(result.site.description).toBe("");
      expect(result.site.maxDepth).toBe(0);
      expect(result.site.difficulty).toBe("intermediate");
      expect(result.site.visibility).toBe("");
      expect(result.site.currentStrength).toBe("");
      expect(result.site.highlights).toEqual([]);
    });
  });

  describe("action", () => {
    it("should update dive site and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Updated Corner",
          description: "Updated description",
          maxDepth: 35,
          difficulty: "advanced",
          latitude: 7.165,
          longitude: 134.271,
          visibility: "20-30m",
          currentStrength: "strong",
          highlights: ["Sharks", "Manta Rays"],
          isActive: true,
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      const mockSchema = {
        diveSites: {
          organizationId: Symbol("organizationId"),
          id: Symbol("id"),
        },
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as any);

      const formData = new FormData();
      formData.append("name", "Updated Corner");
      formData.append("description", "Updated description");
      formData.append("maxDepth", "35");
      formData.append("difficulty", "advanced");
      formData.append("highlights", "Sharks, Manta Rays");

      const request = new Request("http://test.com/tenant/dive-sites/site-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockSiteId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockDb.update).toHaveBeenCalledWith(mockSchema.diveSites);

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/dive-sites/${mockSiteId}`);
    });

    it("should throw 400 if site ID is missing in action", async () => {
      const formData = new FormData();
      formData.append("name", "Test");

      const request = new Request("http://test.com/tenant/dive-sites//edit", {
        method: "POST",
        body: formData,
      });

      try {
        await action({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Dive Site ID required");
      }
    });

    it("should return validation errors for missing required fields", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
          maxDepth: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
        maxDepth: "",
      });

      const formData = new FormData();
      formData.append("name", "");
      formData.append("maxDepth", "");

      const request = new Request("http://test.com/tenant/dive-sites/site-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockSiteId }, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
      expect(result.errors).toHaveProperty("maxDepth", "Required");
    });

    it("should convert highlights comma-separated string to JSON array", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Test Site",
          maxDepth: 20,
          difficulty: "intermediate",
          highlights: ["Sharks", "Coral", "Wreck"],
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { diveSites: {} },
      } as any);

      const formData = new FormData();
      formData.append("name", "Test Site");
      formData.append("highlights", "Sharks, Coral, Wreck");

      const request = new Request("http://test.com/tenant/dive-sites/site-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockSiteId }, context: {} });

      // Verify highlights were set with JSON.stringify call
      const setCallArgs = mockDb.set.mock.calls[0][0];
      expect(setCallArgs.highlights).toEqual(["Sharks", "Coral", "Wreck"]);
    });
  });
});
