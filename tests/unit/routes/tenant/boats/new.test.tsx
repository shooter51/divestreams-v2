/**
 * Tenant Boat New Route Tests
 *
 * Tests the boat creation page loader and action with form validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/boats/new";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  createBoat: vi.fn(),
}));

// Mock validation
vi.mock("../../../../../lib/validation", () => ({
  boatSchema: {},
  validateFormData: vi.fn(),
  getFormValues: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { createBoat } from "../../../../../lib/db/queries.server";
import { validateFormData, getFormValues } from "../../../../../lib/validation";

describe("Route: tenant/boats/new.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should require tenant authentication", async () => {
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
      const result = await action({ request, params: {}, context: {} });

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

    it("should create boat with valid data and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "New Boat");
      formData.append("capacity", "20");
      formData.append("type", "Dive Boat");
      formData.append("description", "A new boat");
      formData.append("registrationNumber", "REG-001");
      formData.append("amenities", "GPS, Radio");
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
          name: "New Boat",
          capacity: 20,
          type: "Dive Boat",
          description: "A new boat",
          registrationNumber: "REG-001",
          amenities: ["GPS", "Radio"],
          isActive: true,
        },
      });
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "New Boat",
        capacity: 20,
        type: "Dive Boat",
        description: "A new boat",
        registrationNumber: "REG-001",
        amenities: ["GPS", "Radio"],
        isActive: true,
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/boats");
    });

    it("should parse comma-separated amenities into array", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "New Boat");
      formData.append("capacity", "20");
      formData.append("amenities", "GPS, Radio, Anchor, Life jackets");
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
          name: "New Boat",
          capacity: 20,
          amenities: ["GPS", "Radio", "Anchor", "Life jackets"],
          isActive: true,
        },
      });
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "New Boat",
        capacity: 20,
        type: undefined,
        description: undefined,
        registrationNumber: undefined,
        amenities: ["GPS", "Radio", "Anchor", "Life jackets"],
        isActive: true,
      });
      expect(result.status).toBe(302);
    });

    it("should handle empty amenities string", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "New Boat");
      formData.append("capacity", "20");
      formData.append("amenities", "");
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
          name: "New Boat",
          capacity: 20,
          amenities: [],
          isActive: true,
        },
      });
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          amenities: undefined,
        })
      );
      expect(result.status).toBe(302);
    });

    it("should handle checkbox isActive field", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Inactive Boat");
      formData.append("capacity", "10");
      // isActive not included means checkbox is unchecked

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
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          isActive: false,
        })
      );
      expect(result.status).toBe(302);
    });

    it("should convert empty strings to undefined for optional fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "Minimal Boat");
      formData.append("capacity", "15");
      formData.append("type", "");
      formData.append("description", "");
      formData.append("registrationNumber", "");
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
          name: "Minimal Boat",
          capacity: 15,
          isActive: true,
        },
      });
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith("org-123", {
        name: "Minimal Boat",
        capacity: 15,
        type: undefined,
        description: undefined,
        registrationNumber: undefined,
        amenities: undefined,
        isActive: true,
      });
      expect(result.status).toBe(302);
    });

    it("should handle amenities with extra spaces", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "New Boat");
      formData.append("capacity", "20");
      formData.append("amenities", " GPS ,  Radio , Anchor  ");
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
          name: "New Boat",
          capacity: 20,
          amenities: ["GPS", "Radio", "Anchor"],
          isActive: true,
        },
      });
      (createBoat as any).mockResolvedValue({ id: "boat-123" });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createBoat).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          amenities: ["GPS", "Radio", "Anchor"],
        })
      );
      expect(result.status).toBe(302);
    });
  });
});
