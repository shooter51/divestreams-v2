/**
 * Tenant Boat Edit Route Tests
 *
 * Tests the boat edit page loader and action with form validation and image loading.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../../app/routes/tenant/boats/$id/edit";

// Mock auth
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock tenant database
vi.mock("../../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../../lib/db/queries.server", () => ({
  getBoatById: vi.fn(),
}));

// Mock validation
vi.mock("../../../../../../lib/validation", () => ({
  boatSchema: {},
  validateFormData: vi.fn(),
  getFormValues: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../../../lib/db/tenant.server";
import { getBoatById } from "../../../../../../lib/db/queries.server";
import { validateFormData, getFormValues } from "../../../../../../lib/validation";

describe("Route: tenant/boats/$id/edit.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBoat = {
    id: "boat-123",
    name: "Sea Explorer",
    type: "Dive Boat",
    capacity: 20,
    description: "A beautiful dive boat",
    registrationNumber: "REG-12345",
    amenities: ["Dive platform", "Sun deck", "Toilet"],
    isActive: true,
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

  describe("loader", () => {
    it("should throw 400 when boat ID is missing", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/edit");
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
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn().mockImplementation(() => {
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue([]);

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

      (getBoatById as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { id: "boat-123" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load boat edit data with images", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn().mockImplementation(() => {
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockImages);

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

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.boat.id).toBe("boat-123");
      expect(result.boat.name).toBe("Sea Explorer");
      expect(result.boat.type).toBe("Dive Boat");
      expect(result.boat.capacity).toBe(20);
      expect(result.boat.description).toBe("A beautiful dive boat");
      expect(result.boat.registrationNumber).toBe("REG-12345");
      expect(result.boat.amenities).toEqual(["Dive platform", "Sun deck", "Toilet"]);
      expect(result.boat.isActive).toBe(true);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe("https://example.com/boat1.jpg");
      expect(result.images[0].isPrimary).toBe(true);
    });

    it("should handle empty images array", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn().mockImplementation(() => {
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue([]);

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

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.images).toEqual([]);
    });

    it("should handle null optional fields", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn().mockImplementation(() => {
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue([]);

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

      const boatWithNulls = {
        ...mockBoat,
        type: null,
        description: null,
        registrationNumber: null,
        amenities: null,
      };

      (getBoatById as any).mockResolvedValue(boatWithNulls);

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.boat.type).toBe("");
      expect(result.boat.description).toBe("");
      expect(result.boat.registrationNumber).toBe("");
      expect(result.boat.amenities).toEqual([]);
    });
  });

  describe("action", () => {
    it("should throw 400 when boat ID is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Updated Boat");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act & Assert
      try {
        await action({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should return errors when validation fails", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "");
      formData.append("capacity", "0");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (validateFormData as any).mockReturnValue({
        success: false,
        errors: {
          name: "Name is required",
          capacity: "Capacity must be at least 1",
        },
      });
      (getFormValues as any).mockReturnValue({
        name: "",
        capacity: "0",
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          name: "Name is required",
          capacity: "Capacity must be at least 1",
        },
        values: {
          name: "",
          capacity: "0",
        },
      });
    });

    it("should parse comma-separated amenities into array", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Updated Boat");
      formData.append("type", "Speed Boat");
      formData.append("capacity", "15");
      formData.append("description", "Updated description");
      formData.append("registrationNumber", "REG-999");
      formData.append("amenities", "GPS, Radio, Anchor");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          boats: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });
      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Updated Boat",
          type: "Speed Boat",
          capacity: 15,
          description: "Updated description",
          registrationNumber: "REG-999",
          amenities: ["GPS", "Radio", "Anchor"],
          isActive: true,
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats/boat-123");
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Boat",
          type: "Speed Boat",
          capacity: 15,
          description: "Updated description",
          registrationNumber: "REG-999",
          amenities: ["GPS", "Radio", "Anchor"],
          isActive: true,
        })
      );
    });

    it("should update boat and redirect to details page", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Updated Boat");
      formData.append("capacity", "15");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          boats: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });
      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Updated Boat",
          capacity: 15,
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats/boat-123");
    });

    it("should handle empty amenities string", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Updated Boat");
      formData.append("capacity", "15");
      formData.append("amenities", "");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          boats: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });
      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Updated Boat",
          capacity: 15,
          amenities: [],
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.status).toBe(302);
    });
  });
});
