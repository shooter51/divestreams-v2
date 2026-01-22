/**
 * Tenant Boat Edit Route Tests
 *
 * Tests the boat edit page loader and action with form data updates.
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
    name: "Ocean Explorer",
    type: "Dive Boat",
    capacity: 12,
    description: "Comfortable dive boat with full amenities",
    registrationNumber: "REG-2024-001",
    amenities: ["Dive platform", "Sun deck", "Toilet", "Shower"],
    isActive: true,
  };

  const mockImages = [
    {
      id: "img-1",
      url: "https://example.com/boat1.jpg",
      thumbnailUrl: "https://example.com/boat1-thumb.jpg",
      filename: "boat1.jpg",
      width: 800,
      height: 600,
      alt: "Front view",
      sortOrder: 0,
      isPrimary: true,
    },
    {
      id: "img-2",
      url: "https://example.com/boat2.jpg",
      thumbnailUrl: null,
      filename: "boat2.jpg",
      width: null,
      height: null,
      alt: null,
      sortOrder: 1,
      isPrimary: false,
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

      const mockSelect = vi.fn();
      (getTenantDb as any).mockReturnValue({
        db: { select: mockSelect },
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
          },
        },
      });

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
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

      const mockSelect = vi.fn();
      (getTenantDb as any).mockReturnValue({
        db: { select: mockSelect },
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
          },
        },
      });

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockImages),
          }),
        }),
      });

      (getBoatById as any).mockResolvedValue(mockBoat);

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(getBoatById).toHaveBeenCalledWith("org-123", "boat-123");
      expect(result.boat.id).toBe("boat-123");
      expect(result.boat.name).toBe("Ocean Explorer");
      expect(result.boat.type).toBe("Dive Boat");
      expect(result.boat.capacity).toBe(12);
      expect(result.boat.amenities).toEqual(["Dive platform", "Sun deck", "Toilet", "Shower"]);
      expect(result.boat.isActive).toBe(true);

      // Verify images are formatted correctly
      expect(result.images).toHaveLength(2);
      expect(result.images[0].id).toBe("img-1");
      expect(result.images[0].isPrimary).toBe(true);
      expect(result.images[1].thumbnailUrl).toBe("https://example.com/boat2.jpg"); // Falls back to url
    });

    it("should handle null optional fields with defaults", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn();
      (getTenantDb as any).mockReturnValue({
        db: { select: mockSelect },
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
          },
        },
      });

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
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

    it("should handle empty images array", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/boat-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const mockSelect = vi.fn();
      (getTenantDb as any).mockReturnValue({
        db: { select: mockSelect },
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
          },
        },
      });

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (getBoatById as any).mockResolvedValue(mockBoat);

      // Act
      const result = await loader({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.images).toEqual([]);
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
        errors: { name: "Required", capacity: "Must be at least 1" },
      });

      (getFormValues as any).mockReturnValue({
        name: "",
        capacity: "0",
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(result.errors.name).toBe("Required");
      expect(result.errors.capacity).toBe("Must be at least 1");
      expect(result.values.name).toBe("");
    });

    it("should update boat with all fields and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Updated Explorer");
      formData.append("type", "Catamaran");
      formData.append("capacity", "16");
      formData.append("description", "Newly refurbished catamaran");
      formData.append("registrationNumber", "REG-2024-002");
      formData.append("amenities", "Dive platform, Sun deck, Bar, Kitchen");
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

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Updated Explorer",
          type: "Catamaran",
          capacity: 16,
          description: "Newly refurbished catamaran",
          registrationNumber: "REG-2024-002",
          amenities: ["Dive platform", "Sun deck", "Bar", "Kitchen"],
          isActive: true,
        },
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

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({
        name: "Updated Explorer",
        type: "Catamaran",
        capacity: 16,
        description: "Newly refurbished catamaran",
        registrationNumber: "REG-2024-002",
        amenities: ["Dive platform", "Sun deck", "Bar", "Kitchen"],
        isActive: true,
        updatedAt: expect.any(Date),
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats/boat-123");
    });

    it("should handle amenities parsing from comma-separated string", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("amenities", "Platform,  Deck  , Kitchen"); // With extra spaces
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

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          amenities: ["Platform", "Deck", "Kitchen"],
          isActive: true,
        },
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

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          amenities: ["Platform", "Deck", "Kitchen"],
        })
      );
    });

    it("should update boat with minimal fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Simple Boat");
      formData.append("capacity", "8");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Simple Boat",
          capacity: 8,
          isActive: false,
        },
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

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Simple Boat",
          capacity: 8,
          isActive: false,
        })
      );
      expect(result.status).toBe(302);
    });

    it("should toggle isActive status", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
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

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          isActive: true,
        },
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

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      await action({ request, params: { id: "boat-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        })
      );
    });
  });
});
