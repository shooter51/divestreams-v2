/**
 * Tenant Boat Details Route Tests
 *
 * Tests the boat details page loader and action with parallel data fetching and multiple intents.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/boats/$id";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
  requireOrgContext: vi.fn(),
}));

// Mock tenant database
vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  getBoatById: vi.fn(),
  getBoatRecentTrips: vi.fn(),
  getBoatUpcomingTrips: vi.fn(),
  getBoatStats: vi.fn(),
  updateBoatActiveStatus: vi.fn(),
  deleteBoat: vi.fn(),
}));

// Import mocked modules
import { requireTenant, requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import {
  getBoatById,
  getBoatRecentTrips,
  getBoatUpcomingTrips,
  getBoatStats,
  updateBoatActiveStatus,
  deleteBoat,
} from "../../../../../lib/db/queries.server";

describe("Route: tenant/boats/$id.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBoat = {
    id: "boat-123",
    name: "Sea Explorer",
    capacity: 20,
    length: "45ft",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  };

  const mockRecentTrips = [
    {
      id: "trip-1",
      date: new Date("2024-01-10"),
      tourName: "Morning Dive",
    },
  ];

  const mockUpcomingTrips = [
    {
      id: "trip-2",
      date: new Date("2024-02-01"),
      tourName: "Afternoon Dive",
    },
  ];

  const mockStats = {
    totalTrips: 150,
    totalRevenue: "50000.00",
    averageCapacity: 15,
  };

  const mockImages = [
    {
      id: "img-1",
      url: "https://example.com/boat1.jpg",
      thumbnailUrl: "https://example.com/boat1-thumb.jpg",
      filename: "boat1.jpg",
      width: 1024,
      height: 768,
      alt: "Boat photo",
      sortOrder: 1,
      isPrimary: true,
    },
  ];

  const mockMaintenanceHistory = [
    {
      id: "maint-1",
      type: "routine",
      description: "Engine check",
      performedAt: new Date("2024-01-05"),
      performedBy: "Tech Smith",
      cost: "500.00",
      notes: "All good",
      nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      nextMaintenanceType: "routine",
      createdAt: new Date("2024-01-05"),
      organizationId: "org-123",
      boatId: "boat-123",
      createdBy: "user-123",
    },
  ];

  describe("loader", () => {
    it("should throw 400 when boat ID is missing", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when boat not found", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (getTenantDb as any).mockReturnValue({
        db: {
          select: mockSelect,
        },
        schema: {
          images: {
            id: "id",
            url: "url",
            thumbnailUrl: "thumbnailUrl",
            filename: "filename",
            width: "width",
            height: "height",
            alt: "alt",
            sortOrder: "sortOrder",
            isPrimary: "isPrimary",
            organizationId: "organizationId",
            entityType: "entityType",
            entityId: "entityId",
          },
        },
      });

      mockSelect.mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      (getBoatById as any).mockResolvedValue(null);
      (getBoatRecentTrips as any).mockResolvedValue([]);
      (getBoatUpcomingTrips as any).mockResolvedValue([]);
      (getBoatStats as any).mockResolvedValue(mockStats);

      // Act & Assert
      try {
        await loader({ request, params: { id: "boat-123" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load boat details with all related data", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Mock db.select to handle two different query chains
      let selectCallCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();

        if (selectCallCount === 1) {
          // First query: boatImages (no limit)
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockResolvedValue(mockImages);
        } else if (selectCallCount === 2) {
          // Second query: maintenanceHistory (with limit)
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockResolvedValue(mockMaintenanceHistory);
        }

        return { from: mockFrom };
      });

      (getTenantDb as any).mockReturnValue({
        db: {
          select: mockSelect,
        },
        schema: {
          images: {
            id: "id",
            url: "url",
            thumbnailUrl: "thumbnailUrl",
            filename: "filename",
            width: "width",
            height: "height",
            alt: "alt",
            sortOrder: "sortOrder",
            isPrimary: "isPrimary",
            organizationId: "organizationId",
            entityType: "entityType",
            entityId: "entityId",
          },
        },
      });

      (getBoatById as any).mockResolvedValue(mockBoat);
      (getBoatRecentTrips as any).mockResolvedValue(mockRecentTrips);
      (getBoatUpcomingTrips as any).mockResolvedValue(mockUpcomingTrips);
      (getBoatStats as any).mockResolvedValue(mockStats);

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(getBoatById).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatRecentTrips).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatUpcomingTrips).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatStats).toHaveBeenCalledWith("org-123", "boat-123");

      expect(result.boat.id).toBe("boat-123");
      expect(result.boat.name).toBe("Sea Explorer");
      expect(result.boat.createdAt).toBe("2024-01-01");
      expect(result.boat.updatedAt).toBe("2024-01-15");

      expect(result.recentTrips).toHaveLength(1);
      expect(result.recentTrips[0].date).toBe("2024-01-10");

      expect(result.upcomingTrips).toHaveLength(1);
      expect(result.upcomingTrips[0].date).toBe("2024-02-01");

      expect(result.stats).toEqual(mockStats);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe("https://example.com/boat1.jpg");

      expect(result.maintenanceHistory).toHaveLength(1);
      expect(result.maintenanceHistory[0].type).toBe("routine");

      expect(result.maintenanceDue).toBe(false);
    });

    it("should set maintenanceDue to true when maintenance date is within 7 days", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const upcomingMaintenance = [
        {
          ...mockMaintenanceHistory[0],
          nextMaintenanceDate: futureDate,
        },
      ];

      // Mock db.select to handle two different query chains
      let selectCallCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();

        if (selectCallCount === 1) {
          // First query: boatImages (no limit)
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockResolvedValue(mockImages);
        } else if (selectCallCount === 2) {
          // Second query: maintenanceHistory (with limit)
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockResolvedValue(upcomingMaintenance);
        }

        return { from: mockFrom };
      });

      (getTenantDb as any).mockReturnValue({
        db: {
          select: mockSelect,
        },
        schema: {
          images: {
            id: "id",
            url: "url",
            thumbnailUrl: "thumbnailUrl",
            filename: "filename",
            width: "width",
            height: "height",
            alt: "alt",
            sortOrder: "sortOrder",
            isPrimary: "isPrimary",
            organizationId: "organizationId",
            entityType: "entityType",
            entityId: "entityId",
          },
        },
      });

      (getBoatById as any).mockResolvedValue(mockBoat);
      (getBoatRecentTrips as any).mockResolvedValue([]);
      (getBoatUpcomingTrips as any).mockResolvedValue([]);
      (getBoatStats as any).mockResolvedValue(mockStats);

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.maintenanceDue).toBe(true);
    });
  });

  describe("action", () => {
    it("should return error when boat ID is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Boat ID required" });
    });

    it("should toggle boat active status", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-123" },
      });
      (getBoatById as any).mockResolvedValue(mockBoat);
      (updateBoatActiveStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(getBoatById).toHaveBeenCalledWith("org-123", "boat-123");
      expect(updateBoatActiveStatus).toHaveBeenCalledWith("org-123", "boat-123", false);
      expect(result).toEqual({ toggled: true });
    });

    it("should delete boat and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-123" },
      });
      (deleteBoat as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(deleteBoat).toHaveBeenCalledWith("org-123", "boat-123");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats");
    });

    it("should log maintenance", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "log-maintenance");
      formData.append("type", "routine");
      formData.append("description", "Engine maintenance");
      formData.append("performedBy", "Tech Smith");
      formData.append("cost", "500.00");
      formData.append("notes", "All systems good");
      formData.append("nextMaintenanceDate", "2024-04-05");
      formData.append("nextMaintenanceType", "routine");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-123" },
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          insert: mockInsert,
        },
      });

      mockInsert.mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        boatId: "boat-123",
        type: "routine",
        description: "Engine maintenance",
        performedBy: "Tech Smith",
        cost: "500.00",
        notes: "All systems good",
        nextMaintenanceDate: "2024-04-05",
        nextMaintenanceType: "routine",
        createdBy: "user-123",
      });
      expect(result).toEqual({ maintenanceLogged: true });
    });

    it("should log maintenance with default values for missing fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "log-maintenance");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-123" },
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          insert: mockInsert,
        },
      });

      mockInsert.mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        boatId: "boat-123",
        type: "routine",
        description: "Maintenance performed",
        performedBy: null,
        cost: null,
        notes: null,
        nextMaintenanceDate: null,
        nextMaintenanceType: null,
        createdBy: "user-123",
      });
      expect(result).toEqual({ maintenanceLogged: true });
    });
  });
});
