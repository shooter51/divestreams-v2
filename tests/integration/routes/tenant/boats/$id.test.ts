import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader, action } from "../../../../../app/routes/tenant/boats/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/db/tenant.server");

describe("app/routes/tenant/boats/$id.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockBoatId = "boat-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      user: { id: "user-123", email: "test@example.com" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as unknown);
  });

  describe("loader", () => {
    it("should fetch boat with trips, stats, images, and maintenance history", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Sea Explorer",
        capacity: 12,
        crewSize: 3,
        type: "liveaboard",
        description: "Luxury dive boat",
        manufacturer: "Custom",
        model: "Explorer 2020",
        yearBuilt: 2020,
        length: "25",
        amenities: ["WiFi", "AC", "Kitchen"],
        isActive: true,
        insuranceExpiry: new Date("2025-12-31"),
        lastMaintenance: new Date("2024-06-01"),
        nextMaintenance: new Date("2024-12-01"),
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-06-01"),
      };

      const mockRecentTrips = [
        {
          id: "trip-1",
          name: "Great Barrier Reef",
          date: new Date("2024-07-01"),
          status: "completed",
          bookingCount: 10,
        },
      ];

      const mockUpcomingTrips = [
        {
          id: "trip-2",
          name: "Coral Sea Adventure",
          date: new Date("2024-08-15"),
          status: "scheduled",
          bookingCount: 8,
        },
      ];

      const mockStats = {
        totalTrips: 25,
        totalRevenue: "125000.00",
        averageOccupancy: 85,
        maintenanceCosts: "15000.00",
      };

      const mockImages = [
        {
          id: "img-1",
          url: "https://example.com/boat.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          filename: "boat.jpg",
          width: 1920,
          height: 1080,
          alt: "Boat photo",
          sortOrder: 0,
          isPrimary: true,
        },
      ];

      const mockMaintenanceHistory = [
        {
          id: "maint-1",
          performedAt: new Date("2024-06-01"),
          maintenanceType: "engine-service",
          performedBy: "Marine Tech",
          description: "Annual engine service",
          cost: "5000.00",
          nextMaintenanceDate: new Date("2024-12-01"),
          performedByUserId: "user-123",
        },
      ];

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as unknown);
      vi.mocked(queries.getBoatRecentTrips).mockResolvedValue(mockRecentTrips as unknown);
      vi.mocked(queries.getBoatUpcomingTrips).mockResolvedValue(mockUpcomingTrips as unknown);
      vi.mocked(queries.getBoatStats).mockResolvedValue(mockStats as unknown);

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockImages),
      };

      const mockMaintenanceBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMaintenanceHistory),
      };

      let selectCallCount = 0;
      const mockSelectFn = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? mockImagesBuilder : mockMaintenanceBuilder;
      });

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: mockSelectFn },
        schema: {
          images: {},
          maintenanceLogs: {},
        },
      } as unknown);

      const request = new Request("http://test.com/tenant/boats/boat-456");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(queries.getBoatById).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(queries.getBoatRecentTrips).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(queries.getBoatUpcomingTrips).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(queries.getBoatStats).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);

      expect(result.boat.name).toBe("Sea Explorer");
      expect(result.recentTrips).toHaveLength(1);
      expect(result.upcomingTrips).toHaveLength(1);
      expect(result.stats.totalTrips).toBe(25);
      expect(result.images).toHaveLength(1);
      expect(result.maintenanceHistory).toHaveLength(1);
    });

    it("should throw 400 if boat ID is missing", async () => {
      const request = new Request("http://test.com/tenant/boats/");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Boat ID required");
      }
    });

    it("should throw 404 if boat not found", async () => {
      vi.mocked(queries.getBoatById).mockResolvedValue(null);

      const request = new Request("http://test.com/tenant/boats/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Boat not found");
      }
    });

    it("should format dates correctly", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Test Boat",
        insuranceExpiry: new Date("2025-12-31T10:30:00Z"),
        lastMaintenance: new Date("2024-06-01T14:20:00Z"),
        nextMaintenance: new Date("2024-12-01T09:00:00Z"),
        createdAt: new Date("2024-01-15T10:30:00Z"),
        updatedAt: new Date("2024-06-01T14:20:00Z"),
      };

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as unknown);
      vi.mocked(queries.getBoatRecentTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatUpcomingTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatStats).mockResolvedValue({ totalTrips: 0 } as unknown);

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockMaintenanceBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      const mockSelectFn = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? mockImagesBuilder : mockMaintenanceBuilder;
      });

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: mockSelectFn },
        schema: { images: {}, maintenanceLogs: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/boats/boat-456");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      // Only createdAt and updatedAt are formatted to strings
      expect(result.boat.createdAt).toBe("2024-01-15");
      expect(result.boat.updatedAt).toBe("2024-06-01");

      // Other date fields remain as Date objects
      expect(result.boat.insuranceExpiry).toEqual(mockBoat.insuranceExpiry);
      expect(result.boat.lastMaintenance).toEqual(mockBoat.lastMaintenance);
      expect(result.boat.nextMaintenance).toEqual(mockBoat.nextMaintenance);
    });

    it("should calculate maintenanceDue correctly", async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

      const mockBoat = {
        id: mockBoatId,
        name: "Test Boat",
      };

      const mockMaintenanceHistory = [
        {
          id: "maint-1",
          performedAt: new Date("2024-06-01"),
          nextMaintenanceDate: futureDate,
        },
      ];

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as unknown);
      vi.mocked(queries.getBoatRecentTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatUpcomingTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatStats).mockResolvedValue({ totalTrips: 0 } as unknown);

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockMaintenanceBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMaintenanceHistory),
      };

      let selectCallCount = 0;
      const mockSelectFn = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? mockImagesBuilder : mockMaintenanceBuilder;
      });

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: mockSelectFn },
        schema: { images: {}, maintenanceLogs: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/boats/boat-456");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(result.maintenanceDue).toBe(true);
    });

    it("should handle null optional fields", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Minimal Boat",
        capacity: 6,
        type: "day-boat",
        manufacturer: null,
        model: null,
        description: null,
        insuranceExpiry: null,
        lastMaintenance: null,
        nextMaintenance: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as unknown);
      vi.mocked(queries.getBoatRecentTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatUpcomingTrips).mockResolvedValue([]);
      vi.mocked(queries.getBoatStats).mockResolvedValue({ totalTrips: 0 } as unknown);

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockMaintenanceBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      const mockSelectFn = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? mockImagesBuilder : mockMaintenanceBuilder;
      });

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: mockSelectFn },
        schema: { images: {}, maintenanceLogs: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/boats/boat-456");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(result.boat.insuranceExpiry).toBeNull();
      expect(result.boat.lastMaintenance).toBeNull();
      expect(result.boat.nextMaintenance).toBeNull();
    });
  });

  describe("action", () => {
    it("should toggle boat active status", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Test Boat",
        isActive: true,
      };

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as unknown);
      vi.mocked(queries.updateBoatActiveStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "toggle-active");

      const request = new Request("http://test.com/tenant/boats/boat-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(queries.getBoatById).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(queries.updateBoatActiveStatus).toHaveBeenCalledWith(
        mockOrganizationId,
        mockBoatId,
        false
      );
      expect(result).toEqual({ toggled: true });
    });

    it("should log maintenance record", async () => {
      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        insert: vi.fn().mockReturnValue(mockInsertBuilder),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { maintenanceLogs: {} },
      } as unknown);

      const formData = new FormData();
      formData.append("intent", "log-maintenance");
      formData.append("maintenanceType", "engine-service");
      formData.append("performedBy", "Marine Tech");
      formData.append("description", "Annual service");
      formData.append("cost", "5000.00");
      formData.append("nextMaintenanceDate", "2024-12-01");

      const request = new Request("http://test.com/tenant/boats/boat-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual({ maintenanceLogged: true });
    });

    it("should delete boat and redirect", async () => {
      vi.mocked(queries.deleteBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/tenant/boats/boat-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(queries.deleteBoat).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/boats");
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/boats/boat-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(result).toBeNull();
    });
  });
});
