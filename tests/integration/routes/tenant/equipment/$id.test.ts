import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/equipment/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../lib/db/tenant.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/db/tenant.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("app/routes/tenant/equipment/$id.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockEquipmentId = "eq-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      user: { id: "user-123", email: "test@example.com" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as any);
  });

  describe("loader", () => {
    it("should fetch equipment with rental history, stats, service history, and images", async () => {
      const mockEquipment = {
        id: mockEquipmentId,
        name: "BCD Pro",
        brand: "Aqualung",
        model: "Pro HD",
        category: "bcd",
        status: "available",
        condition: "excellent",
        isRentable: true,
        rentalPrice: "25.00",
        serialNumber: "SN12345",
        purchaseDate: new Date("2024-01-15"),
        lastServiceDate: new Date("2024-06-01"),
        notes: "Test notes",
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-06-01"),
      };

      const mockRentalHistory = [
        {
          id: "rental-1",
          customerName: "John Doe",
          startDate: new Date("2024-07-01"),
          endDate: new Date("2024-07-03"),
          totalPrice: "75.00",
          status: "completed",
        },
      ];

      const mockStats = {
        totalRentals: 15,
        totalRevenue: "1125.00",
        averageRentalDuration: 2.5,
        utilizationRate: 68,
      };

      const mockServiceHistory = [
        {
          id: "service-1",
          serviceDate: new Date("2024-06-01"),
          serviceType: "maintenance",
          performedBy: "Tech Team",
          notes: "Annual service",
          cost: "50.00",
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
          alt: "Equipment photo",
          sortOrder: 0,
          isPrimary: true,
        },
      ];

      vi.mocked(queries.getEquipmentById).mockResolvedValue(mockEquipment as any);
      vi.mocked(queries.getEquipmentRentalHistory).mockResolvedValue(mockRentalHistory as any);
      vi.mocked(queries.getEquipmentRentalStats).mockResolvedValue(mockStats as any);
      vi.mocked(queries.getEquipmentServiceHistory).mockResolvedValue(mockServiceHistory as any);

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

      const request = new Request("http://test.com/app/equipment/eq-456");
      const result = await loader({ request, params: { id: mockEquipmentId }, context: {} });

      expect(queries.getEquipmentById).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);
      expect(queries.getEquipmentRentalHistory).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);
      expect(queries.getEquipmentRentalStats).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);
      expect(queries.getEquipmentServiceHistory).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);

      expect(result.equipment.name).toBe("BCD Pro");
      expect(result.rentalHistory).toHaveLength(1);
      expect(result.stats.totalRentals).toBe(15);
      expect(result.serviceHistory).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });

    it("should throw 400 if equipment ID is missing", async () => {
      const request = new Request("http://test.com/app/equipment/");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Equipment ID required");
      }
    });

    it("should throw 404 if equipment not found", async () => {
      vi.mocked(queries.getEquipmentById).mockResolvedValue(null);

      const request = new Request("http://test.com/app/equipment/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Equipment not found");
      }
    });

    it("should format dates correctly", async () => {
      const mockEquipment = {
        id: mockEquipmentId,
        name: "Test Equipment",
        purchaseDate: new Date("2024-01-15T10:30:00Z"),
        lastServiceDate: new Date("2024-06-01T14:20:00Z"),
        createdAt: new Date("2024-01-15T10:30:00Z"),
        updatedAt: new Date("2024-06-01T14:20:00Z"),
      };

      vi.mocked(queries.getEquipmentById).mockResolvedValue(mockEquipment as any);
      vi.mocked(queries.getEquipmentRentalHistory).mockResolvedValue([
        {
          id: "rental-1",
          customerFirstName: "John",
          customerLastName: "Doe",
          rentedAt: new Date("2024-07-01"),
          returnedAt: new Date("2024-07-03"),
          dueAt: new Date("2024-07-03"),
          dailyRate: "25.00",
          totalCharge: "75.00",
          status: "completed",
        },
      ] as any);
      vi.mocked(queries.getEquipmentRentalStats).mockResolvedValue({ totalRentals: 0 } as any);
      vi.mocked(queries.getEquipmentServiceHistory).mockResolvedValue([
        {
          id: "service-1",
          performedAt: new Date("2024-06-01"),
          serviceType: "maintenance",
          performedBy: "Tech",
          notes: null,
          cost: "50.00",
        },
      ] as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/app/equipment/eq-456");
      const result = await loader({ request, params: { id: mockEquipmentId }, context: {} });

      expect(result.equipment.purchaseDate).toBe("2024-01-15");
      expect(result.equipment.lastServiceDate).toBe("2024-06-01");
      expect(result.equipment.createdAt).toBe("2024-01-15");
      expect(result.equipment.updatedAt).toBe("2024-06-01");
      expect(result.rentalHistory[0].date).toBe("2024-07-01");
      expect(result.serviceHistory[0].date).toBe("2024-06-01");
    });

    it("should handle null optional fields", async () => {
      const mockEquipment = {
        id: mockEquipmentId,
        name: "Minimal Equipment",
        brand: null,
        model: null,
        category: "other",
        status: "available",
        condition: "good",
        isRentable: false,
        rentalPrice: null,
        serialNumber: null,
        purchaseDate: null,
        lastServiceDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(queries.getEquipmentById).mockResolvedValue(mockEquipment as any);
      vi.mocked(queries.getEquipmentRentalHistory).mockResolvedValue([]);
      vi.mocked(queries.getEquipmentRentalStats).mockResolvedValue({ totalRentals: 0 } as any);
      vi.mocked(queries.getEquipmentServiceHistory).mockResolvedValue([]);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/app/equipment/eq-456");
      const result = await loader({ request, params: { id: mockEquipmentId }, context: {} });

      expect(result.equipment.purchaseDate).toBeNull();
      expect(result.equipment.lastServiceDate).toBeNull();
      expect(result.equipment.notes).toBeNull();
    });
  });

  describe("action", () => {
    it("should update equipment status", async () => {
      vi.mocked(queries.updateEquipmentStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "rented");

      const request = new Request("http://test.com/app/equipment/eq-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(queries.updateEquipmentStatus).toHaveBeenCalledWith(
        mockOrganizationId,
        mockEquipmentId,
        "rented"
      );
      expect(result).toEqual({ statusUpdated: true });
    });

    it("should log service record", async () => {
      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.insert).mockReturnValue(mockInsertBuilder as any);

      const formData = new FormData();
      formData.append("intent", "log-service");
      formData.append("serviceType", "maintenance");
      formData.append("performedBy", "Tech Team");
      formData.append("notes", "Regular maintenance");
      formData.append("cost", "50.00");

      const request = new Request("http://test.com/app/equipment/eq-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ serviceLogged: true });
    });

    it("should retire equipment", async () => {
      vi.mocked(queries.updateEquipmentStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "retire");

      const request = new Request("http://test.com/app/equipment/eq-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(queries.updateEquipmentStatus).toHaveBeenCalledWith(
        mockOrganizationId,
        mockEquipmentId,
        "retired"
      );
      expect(result).toEqual({ retired: true });
    });

    it("should delete equipment and redirect", async () => {
      vi.mocked(queries.deleteEquipment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/app/equipment/eq-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(queries.deleteEquipment).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/equipment");
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/app/equipment/eq-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(result).toBeNull();
    });
  });
});
