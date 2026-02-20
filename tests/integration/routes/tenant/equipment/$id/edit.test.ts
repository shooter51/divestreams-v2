import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/equipment/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";
import * as validation from "../../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");
vi.mock("../../../../../../lib/validation");

describe("app/routes/tenant/equipment/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockEquipmentId = "eq-456";

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
    it("should fetch equipment for editing", async () => {
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
        barcode: "123456789",
        purchaseDate: new Date("2024-01-15"),
        lastServiceDate: new Date("2024-06-01"),
        notes: "Test notes",
        isPublic: true,
      };

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

      vi.mocked(queries.getEquipmentById).mockResolvedValue(mockEquipment as unknown);

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

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit");
      const result = await loader({ request, params: { id: mockEquipmentId }, context: {} });

      expect(queries.getEquipmentById).toHaveBeenCalledWith(mockOrganizationId, mockEquipmentId);
      expect(result.equipment.id).toBe(mockEquipmentId);
      expect(result.equipment.name).toBe("BCD Pro");
      expect(result.equipment.barcode).toBe("123456789");
      expect(result.images).toHaveLength(1);
    });

    it("should throw 400 if equipment ID is missing", async () => {
      const request = new Request("http://test.com/tenant/equipment//edit");

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

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/equipment/nonexistent/edit");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Equipment not found");
      }
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
        barcode: null,
        purchaseDate: null,
        lastServiceDate: null,
        notes: null,
        isPublic: false,
      };

      vi.mocked(queries.getEquipmentById).mockResolvedValue(mockEquipment as unknown);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as unknown);

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit");
      const result = await loader({ request, params: { id: mockEquipmentId }, context: {} });

      expect(result.equipment.brand).toBe("");
      expect(result.equipment.model).toBe("");
      expect(result.equipment.serialNumber).toBe("");
      expect(result.equipment.barcode).toBe("");
      expect(result.equipment.notes).toBe("");
    });
  });

  describe("action", () => {
    it("should update equipment and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Updated BCD",
          brand: "Scubapro",
          model: "X-Black",
          category: "bcd",
          status: "available",
          condition: "excellent",
          isRentable: true,
          rentalPrice: "30.00",
          serialNumber: "SN99999",
          purchaseDate: new Date("2024-02-01"),
          lastServiceDate: new Date("2024-07-01"),
          notes: "Updated notes",
        } as unknown,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      const mockSchema = {
        equipment: {
          organizationId: Symbol("organizationId"),
          id: Symbol("id"),
        },
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as unknown);

      const formData = new FormData();
      formData.append("name", "Updated BCD");
      formData.append("brand", "Scubapro");
      formData.append("barcode", "987654321");
      formData.append("isPublic", "true");

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockDb.update).toHaveBeenCalledWith(mockSchema.equipment);

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/equipment/${mockEquipmentId}`);
    });

    it("should throw 400 if equipment ID is missing in action", async () => {
      const formData = new FormData();
      formData.append("name", "Test");

      const request = new Request("http://test.com/tenant/equipment//edit", {
        method: "POST",
        body: formData,
      });

      try {
        await action({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Equipment ID required");
      }
    });

    it("should return validation errors for missing required fields", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
          category: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
        category: "",
      });

      const formData = new FormData();
      formData.append("name", "");
      formData.append("category", "");

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockEquipmentId }, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
      expect(result.errors).toHaveProperty("category", "Required");
    });

    it("should handle barcode and isPublic fields separately from validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Test Equipment",
          category: "bcd",
          status: "available",
          condition: "good",
          isRentable: true,
        } as unknown,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { equipment: {} },
      } as unknown);

      const formData = new FormData();
      formData.append("name", "Test Equipment");
      formData.append("barcode", "NEW123");
      formData.append("isPublic", "true");

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockEquipmentId }, context: {} });

      // Verify barcode and isPublic were included in the update
      const setCallArgs = mockDb.set.mock.calls[0][0];
      expect(setCallArgs.barcode).toBe("NEW123");
      expect(setCallArgs.isPublic).toBe(true);
    });

    it("should handle isPublic checkbox unchecked", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Test Equipment",
          category: "bcd",
        } as unknown,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { equipment: {} },
      } as unknown);

      const formData = new FormData();
      formData.append("name", "Test Equipment");
      // isPublic not in formData = unchecked

      const request = new Request("http://test.com/tenant/equipment/eq-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockEquipmentId }, context: {} });

      const setCallArgs = mockDb.set.mock.calls[0][0];
      expect(setCallArgs.isPublic).toBe(false);
    });
  });
});
