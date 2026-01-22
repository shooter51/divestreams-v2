/**
 * Tenant Boat Details Route Tests
 *
 * Tests the boat details page loader and action with images, trips, stats, and maintenance.
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
    name: "Ocean Explorer",
    type: "dive_boat",
    capacity: 20,
    registrationNumber: "REG-12345",
    description: "Large dive boat with modern amenities",
    isActive: true,
    amenities: ["GPS", "First Aid", "Oxygen"],
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-15T14:30:00Z"),
  };

  const mockRecentTrips = [
    {
      id: "trip-1",
      tourName: "Morning Reef Dive",
      date: new Date("2024-01-10T09:00:00Z"),
      participants: 15,
      revenue: "$750.00",
    },
  ];

  const mockUpcomingTrips = [
    {
      id: "trip-2",
      tourName: "Sunset Dive",
      date: new Date("2024-02-15T17:00:00Z"),
      bookedParticipants: 12,
      maxParticipants: 20,
    },
  ];

  const mockStats = {
    totalTrips: 45,
    totalPassengers: 680,
    totalRevenue: "$34,000",
    avgOccupancy: 85,
  };

  const mockImages = [
    {
      id: "img-1",
      url: "https://example.com/boat1.jpg",
      thumbnailUrl: "https://example.com/boat1-thumb.jpg",
      filename: "boat1.jpg",
      width: 800,
      height: 600,
      alt: "Boat exterior",
      sortOrder: 1,
      isPrimary: true,
    },
  ];

  const mockMaintenanceHistory = [
    {
      id: "maint-1",
      type: "routine",
      description: "Engine oil change",
      performedBy: "Marine Services Inc",
      cost: "450.00",
      notes: "All systems normal",
      performedAt: new Date("2024-01-05T10:00:00Z"),
      nextMaintenanceDate: new Date("2024-04-05T00:00:00Z"),
      nextMaintenanceType: "routine",
      createdAt: new Date("2024-01-05T10:00:00Z"),
      boatId: "boat-123",
      organizationId: "org-123",
      createdBy: "user-1",
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
      const request = new Request("http://localhost/tenant/boats/boat-999");
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

      (getBoatById as any).mockResolvedValue(null);
      (getBoatRecentTrips as any).mockResolvedValue([]);
      (getBoatUpcomingTrips as any).mockResolvedValue([]);
      (getBoatStats as any).mockResolvedValue(mockStats);

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
      mockLimit.mockResolvedValue([]);

      // Act & Assert
      try {
        await loader({ request, params: { id: "boat-999" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load boat details with images, trips, stats, and maintenance", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn();
      const mockFrom = vi.fn();
      const mockWhere = vi.fn();
      const mockOrderBy = vi.fn();
      const mockLimit = vi.fn();

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

      // First select call - images query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockImages),
          }),
        }),
      });

      // Second select call - maintenance history query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockMaintenanceHistory),
            }),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(getBoatById).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatRecentTrips).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatUpcomingTrips).toHaveBeenCalledWith("org-123", "boat-123");
      expect(getBoatStats).toHaveBeenCalledWith("org-123", "boat-123");

      expect(result.boat.id).toBe("boat-123");
      expect(result.boat.name).toBe("Ocean Explorer");
      expect(result.boat.createdAt).toBe("2024-01-01");
      expect(result.boat.updatedAt).toBe("2024-01-15");

      expect(result.recentTrips).toHaveLength(1);
      expect(result.recentTrips[0].date).toBe("2024-01-10");

      expect(result.upcomingTrips).toHaveLength(1);
      expect(result.upcomingTrips[0].date).toBe("2024-02-15");

      expect(result.stats).toEqual(mockStats);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe("https://example.com/boat1.jpg");

      expect(result.maintenanceHistory).toHaveLength(1);
      expect(result.maintenanceHistory[0].type).toBe("routine");
    });

    it("should calculate maintenance due when next date is within 7 days", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn();
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

      // Images query
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Maintenance history with due date in 3 days
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const maintenanceWithDueDate = [
        {
          ...mockMaintenanceHistory[0],
          nextMaintenanceDate: threeDaysFromNow,
        },
      ];

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(maintenanceWithDueDate),
            }),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.maintenanceDue).toBe(true);
    });

    it("should handle empty images and maintenance history", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn();
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

      // Images query - empty
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Maintenance history - empty
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.images).toEqual([]);
      expect(result.maintenanceHistory).toEqual([]);
      expect(result.maintenanceDue).toBe(false);
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
        user: { id: "user-1" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Boat ID required" });
    });

    it("should toggle boat active status to inactive", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-1" },
      });

      (getBoatById as any).mockResolvedValue({ ...mockBoat, isActive: true });
      (updateBoatActiveStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(getBoatById).toHaveBeenCalledWith("org-123", "boat-123");
      expect(updateBoatActiveStatus).toHaveBeenCalledWith("org-123", "boat-123", false);
      expect(result).toEqual({ toggled: true });
    });

    it("should toggle boat active status to active", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-1" },
      });

      (getBoatById as any).mockResolvedValue({ ...mockBoat, isActive: false });
      (updateBoatActiveStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(updateBoatActiveStatus).toHaveBeenCalledWith("org-123", "boat-123", true);
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
        user: { id: "user-1" },
      });

      (deleteBoat as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(deleteBoat).toHaveBeenCalledWith("org-123", "boat-123");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats");
    });

    it("should log maintenance with all fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "log-maintenance");
      formData.append("type", "repair");
      formData.append("description", "Fixed engine issue");
      formData.append("performedBy", "Marine Mechanic Co");
      formData.append("cost", "850.00");
      formData.append("notes", "Replaced fuel pump");
      formData.append("nextMaintenanceDate", "2024-06-01");
      formData.append("nextMaintenanceType", "inspection");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-1" },
      });

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

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
        type: "repair",
        description: "Fixed engine issue",
        performedBy: "Marine Mechanic Co",
        cost: "850.00",
        notes: "Replaced fuel pump",
        nextMaintenanceDate: "2024-06-01",
        nextMaintenanceType: "inspection",
        createdBy: "user-1",
      });
      expect(result).toEqual({ maintenanceLogged: true });
    });

    it("should log maintenance with only required fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "log-maintenance");
      formData.append("type", "routine");
      formData.append("description", "Oil change");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-1" },
      });

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

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
        description: "Oil change",
        performedBy: null,
        cost: null,
        notes: null,
        nextMaintenanceDate: null,
        nextMaintenanceType: null,
        createdBy: "user-1",
      });
      expect(result).toEqual({ maintenanceLogged: true });
    });

    it("should default type to routine and description when not provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "log-maintenance");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        user: { id: "user-1" },
      });

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

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
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "routine",
          description: "Maintenance performed",
        })
      );
    });
  });
});
