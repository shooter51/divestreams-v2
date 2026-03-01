import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader, action } from "../../../../../app/routes/tenant/dive-sites/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/db/tenant.server");

describe("app/routes/tenant/dive-sites/$id.tsx", () => {
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
    } as unknown);
  });

  describe("loader", () => {
    it("should fetch dive site with stats, trips, tours, and images", async () => {
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
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-16"),
      };

      const mockStats = {
        totalTrips: 42,
        totalDivers: 156,
        avgRating: 4.8,
      };

      const mockTrips = [
        {
          id: "trip-1",
          tourName: "Morning Dive",
          date: new Date("2024-02-01"),
          participants: 6,
          conditions: "Good visibility",
        },
      ];

      const mockTours = [
        {
          id: "tour-1",
          name: "Advanced Package",
        },
      ];

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

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as unknown);
      vi.mocked(queries.getDiveSiteStats).mockResolvedValue(mockStats as unknown);
      vi.mocked(queries.getRecentTripsForDiveSite).mockResolvedValue(mockTrips as unknown);
      vi.mocked(queries.getToursUsingDiveSite).mockResolvedValue(mockTours as unknown);

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
      } as unknown);

      const request = new Request("http://test.com/tenant/dive-sites/site-456");
      const result = await loader({ request, params: { id: mockSiteId }, context: {} });

      expect(queries.getDiveSiteById).toHaveBeenCalledWith(mockOrganizationId, mockSiteId);
      expect(queries.getDiveSiteStats).toHaveBeenCalledWith(mockOrganizationId, mockSiteId);
      expect(queries.getRecentTripsForDiveSite).toHaveBeenCalledWith(mockOrganizationId, mockSiteId, 5);
      expect(queries.getToursUsingDiveSite).toHaveBeenCalledWith(mockOrganizationId, mockSiteId, 5);

      expect(result.diveSite.name).toBe("Blue Corner");
      expect(result.diveSite.coordinates).toEqual({ lat: "7.165", lng: "134.271" });
      expect(result.stats.totalTrips).toBe(42);
      expect(result.recentTrips).toHaveLength(1);
      expect(result.toursUsingSite).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });

    it("should throw 400 if site ID is missing", async () => {
      const request = new Request("http://test.com/tenant/dive-sites/");

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

      const request = new Request("http://test.com/tenant/dive-sites/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Dive site not found");
      }
    });

    it("should format dates correctly", async () => {
      const mockSite = {
        id: mockSiteId,
        name: "Test Site",
        description: "Test",
        maxDepth: "20",
        difficulty: "beginner",
        latitude: null,
        longitude: null,
        visibility: null,
        currentStrength: null,
        highlights: [],
        isActive: true,
        createdAt: new Date("2024-01-15T10:30:00Z"),
        updatedAt: new Date("2024-01-16T14:20:00Z"),
      };

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as unknown);
      vi.mocked(queries.getDiveSiteStats).mockResolvedValue({
        totalTrips: 0,
        totalDivers: 0,
        avgRating: null,
      } as unknown);
      vi.mocked(queries.getRecentTripsForDiveSite).mockResolvedValue([
        {
          id: "trip-1",
          tourName: "Test",
          date: new Date("2024-02-01"),
          participants: 2,
          conditions: null,
        },
      ] as unknown);
      vi.mocked(queries.getToursUsingDiveSite).mockResolvedValue([]);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/dive-sites/site-456");
      const result = await loader({ request, params: { id: mockSiteId }, context: {} });

      expect(result.diveSite.createdAt).toBe("2024-01-15");
      expect(result.diveSite.updatedAt).toBe("2024-01-16");
      expect(result.recentTrips[0].date).toBe("2024-02-01");
    });

    it("should handle null coordinates", async () => {
      const mockSite = {
        id: mockSiteId,
        name: "No GPS Site",
        description: "Unknown location",
        maxDepth: "15",
        difficulty: "intermediate",
        latitude: null,
        longitude: null,
        visibility: "10-15m",
        currentStrength: "mild",
        highlights: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as unknown);
      vi.mocked(queries.getDiveSiteStats).mockResolvedValue({
        totalTrips: 0,
        totalDivers: 0,
        avgRating: null,
      } as unknown);
      vi.mocked(queries.getRecentTripsForDiveSite).mockResolvedValue([]);
      vi.mocked(queries.getToursUsingDiveSite).mockResolvedValue([]);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/dive-sites/site-456");
      const result = await loader({ request, params: { id: mockSiteId }, context: {} });

      expect(result.diveSite.coordinates).toBeNull();
    });
  });

  describe("action", () => {
    it("should toggle site active status", async () => {
      const mockSite = {
        id: mockSiteId,
        isActive: true,
      };

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as unknown);
      vi.mocked(queries.updateDiveSiteActiveStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "toggle-active");

      const request = new Request("http://test.com/tenant/dive-sites/site-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockSiteId }, context: {} });

      expect(queries.updateDiveSiteActiveStatus).toHaveBeenCalledWith(
        mockOrganizationId,
        mockSiteId,
        false
      );
      expect(result).toEqual({ toggled: true });
    });

    it("should delete site", async () => {
      const mockSite = {
        id: mockSiteId,
        name: "Blue Corner",
      };

      vi.mocked(queries.getDiveSiteById).mockResolvedValue(mockSite as unknown);
      vi.mocked(queries.deleteDiveSite).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/tenant/dive-sites/site-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockSiteId }, context: {} });

      expect(queries.deleteDiveSite).toHaveBeenCalledWith(mockOrganizationId, mockSiteId);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
      expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe("/tenant/dive-sites");
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/dive-sites/site-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockSiteId }, context: {} });

      expect(result).toBeNull();
    });
  });
});
