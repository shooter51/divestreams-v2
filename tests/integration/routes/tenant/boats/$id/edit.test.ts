import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/boats/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";
import * as validation from "../../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");
vi.mock("../../../../../../lib/validation");

describe("app/routes/tenant/boats/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockBoatId = "boat-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch boat for editing with images", async () => {
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
        beam: "6",
        draft: "2",
        hullMaterial: "Fiberglass",
        engineType: "Diesel",
        fuelCapacity: "500",
        waterCapacity: "300",
        amenities: ["WiFi", "AC", "Kitchen"],
        homePort: "Port Douglas",
        registrationNumber: "REG123",
        insuranceExpiry: new Date("2025-12-31"),
        lastMaintenance: new Date("2024-06-01"),
        nextMaintenance: new Date("2024-12-01"),
        isActive: true,
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

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockImages),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/boats/boat-456/edit");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(queries.getBoatById).toHaveBeenCalledWith(mockOrganizationId, mockBoatId);
      expect(result.boat.id).toBe(mockBoatId);
      expect(result.boat.name).toBe("Sea Explorer");
      expect(result.boat.amenities).toEqual(["WiFi", "AC", "Kitchen"]);
      expect(result.images).toHaveLength(1);
    });

    it("should throw 400 if boat ID is missing", async () => {
      const request = new Request("http://test.com/tenant/boats//edit");

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

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/boats/nonexistent/edit");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Boat not found");
      }
    });

    it("should handle empty amenities array", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Simple Boat",
        capacity: 6,
        amenities: [],
      };

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/boats/boat-456/edit");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(result.boat.amenities).toEqual([]);
    });

    it("should handle null optional fields", async () => {
      const mockBoat = {
        id: mockBoatId,
        name: "Minimal Boat",
        capacity: 6,
        crewSize: null,
        type: "day-boat",
        description: null,
        manufacturer: null,
        model: null,
        yearBuilt: null,
        amenities: null,
        homePort: null,
      };

      vi.mocked(queries.getBoatById).mockResolvedValue(mockBoat as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
        schema: { images: {} },
      } as any);

      const request = new Request("http://test.com/tenant/boats/boat-456/edit");
      const result = await loader({ request, params: { id: mockBoatId }, context: {} });

      expect(result.boat.description).toBe("");
      expect(result.boat.manufacturer).toBeUndefined();
      expect(result.boat.model).toBeUndefined();
      expect(result.boat.amenities).toEqual([]);
    });
  });

  describe("action", () => {
    it("should update boat and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Updated Explorer",
          capacity: 15,
          crewSize: 4,
          type: "liveaboard",
          amenities: ["WiFi", "AC"],
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { boats: {} },
      } as any);

      const formData = new FormData();
      formData.append("name", "Updated Explorer");
      formData.append("capacity", "15");
      formData.append("amenities", "WiFi, AC");

      const request = new Request("http://test.com/tenant/boats/boat-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockDb.update).toHaveBeenCalled();

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/boats/${mockBoatId}`);
    });

    it("should throw 400 if boat ID is missing in action", async () => {
      const formData = new FormData();
      formData.append("name", "Test");

      const request = new Request("http://test.com/tenant/boats//edit", {
        method: "POST",
        body: formData,
      });

      try {
        await action({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Boat ID required");
      }
    });

    it("should return validation errors for missing required fields", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
          capacity: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
        capacity: "",
      });

      const formData = new FormData();
      formData.append("name", "");
      formData.append("capacity", "");

      const request = new Request("http://test.com/tenant/boats/boat-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBoatId }, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
      expect(result.errors).toHaveProperty("capacity", "Required");
    });

    it("should handle amenities conversion from comma-separated string to JSON", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          amenities: ["WiFi", "AC", "Kitchen"],
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { boats: {} },
      } as any);

      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("amenities", "WiFi, AC, Kitchen");

      const request = new Request("http://test.com/tenant/boats/boat-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockBoatId }, context: {} });

      // Verify amenities were processed
      expect(validation.validateFormData).toHaveBeenCalled();
    });

    it("should handle empty amenities string", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: { boats: {} },
      } as any);

      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("amenities", "");

      const request = new Request("http://test.com/tenant/boats/boat-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockBoatId }, context: {} });

      expect(validation.validateFormData).toHaveBeenCalled();
    });
  });
});
