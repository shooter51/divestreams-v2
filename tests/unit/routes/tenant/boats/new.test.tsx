/**
 * Tenant Boat New Route Tests
 *
 * Tests the boat creation form with validation and data handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/boats/new";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock validation
vi.mock("../../../../../lib/validation", () => ({
  boatSchema: {},
  validateFormData: vi.fn(),
  getFormValues: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  createBoat: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { validateFormData, getFormValues } from "../../../../../lib/validation";
import { createBoat } from "../../../../../lib/db/queries.server";

describe("Route: tenant/boats/new.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return empty object after auth check", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats/new");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(requireTenant).toHaveBeenCalledWith(request);
      expect(result).toEqual({});
    });
  });

  describe("action", () => {
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
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors.name).toBe("Required");
      expect(result.errors.capacity).toBe("Must be at least 1");
      expect(result.values.name).toBe("");
    });

    it("should create boat with all fields and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Ocean Explorer");
      formData.append("type", "Dive Boat");
      formData.append("capacity", "12");
      formData.append("description", "Large dive boat with full amenities");
      formData.append("registrationNumber", "REG-2024-001");
      formData.append("amenities", "Dive platform, Sun deck, Toilet, Shower");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Ocean Explorer",
          type: "Dive Boat",
          capacity: 12,
          description: "Large dive boat with full amenities",
          registrationNumber: "REG-2024-001",
          amenities: ["Dive platform", "Sun deck", "Toilet", "Shower"],
          isActive: true,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "Ocean Explorer",
        type: "Dive Boat",
        capacity: 12,
        description: "Large dive boat with full amenities",
        registrationNumber: "REG-2024-001",
        amenities: ["Dive platform", "Sun deck", "Toilet", "Shower"],
        isActive: true,
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats");
    });

    it("should create boat with minimal required fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Simple Boat");
      formData.append("capacity", "8");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

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

      (createBoat as any).mockResolvedValue({
        id: "boat-new-456",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "Simple Boat",
        type: undefined,
        capacity: 8,
        description: undefined,
        registrationNumber: undefined,
        amenities: undefined,
        isActive: false,
      });
      expect(result.status).toBe(302);
    });

    it("should handle amenities parsing from comma-separated string", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("amenities", "Platform,  Deck  , Kitchen , ,"); // With extra spaces and empty items
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

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

      (createBoat as any).mockResolvedValue({
        id: "boat-new-789",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          amenities: ["Platform", "Deck", "Kitchen"],
        })
      );
    });

    it("should handle empty amenities field", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("amenities", "");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          isActive: false,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-999",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          amenities: undefined,
        })
      );
    });

    it("should handle missing amenities field", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      // amenities not appended

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          isActive: false,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-888",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          amenities: undefined,
        })
      );
    });

    it("should convert empty strings to undefined for optional fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "10");
      formData.append("type", "");
      formData.append("description", "");
      formData.append("registrationNumber", "");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 10,
          isActive: false,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-777",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "Test Boat",
        type: undefined,
        capacity: 10,
        description: undefined,
        registrationNumber: undefined,
        amenities: undefined,
        isActive: false,
      });
    });

    it("should handle isActive checkbox when checked", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Active Boat");
      formData.append("capacity", "10");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Active Boat",
          capacity: 10,
          isActive: true,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-666",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          isActive: true,
        })
      );
    });

    it("should handle isActive checkbox when unchecked", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Inactive Boat");
      formData.append("capacity", "10");
      // isActive not appended (checkbox unchecked)

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Inactive Boat",
          capacity: 10,
          isActive: false,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-555",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it("should parse capacity as number", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "15");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      (validateFormData as any).mockReturnValue({
        success: true,
        data: {
          name: "Test Boat",
          capacity: 15,
          isActive: false,
        },
      });

      (createBoat as any).mockResolvedValue({
        id: "boat-new-444",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          capacity: 15, // Should be number, not string
        })
      );
    });
  });
});
