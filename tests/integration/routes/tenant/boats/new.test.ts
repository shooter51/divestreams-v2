import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { action } from "../../../../../app/routes/tenant/boats/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as validation from "../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/validation");

describe("app/routes/tenant/boats/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("action", () => {
    it("should create boat and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Sea Explorer");
      formData.append("capacity", "12");
      formData.append("crewSize", "3");
      formData.append("type", "liveaboard");
      formData.append("description", "Luxury dive boat");
      formData.append("manufacturer", "Custom");
      formData.append("model", "Explorer 2020");
      formData.append("yearBuilt", "2020");
      formData.append("length", "25");
      formData.append("beam", "6");
      formData.append("draft", "2");
      formData.append("hullMaterial", "Fiberglass");
      formData.append("engineType", "Diesel");
      formData.append("fuelCapacity", "500");
      formData.append("waterCapacity", "300");
      formData.append("amenities", "WiFi, AC, Kitchen");
      formData.append("homePort", "Port Douglas");
      formData.append("registrationNumber", "REG123");
      formData.append("insuranceExpiry", "2025-12-31");
      formData.append("isActive", "true");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Sea Explorer",
          capacity: 12,
          type: "liveaboard",
          description: "Luxury dive boat",
          registrationNumber: "REG123",
          amenities: ["WiFi", "AC", "Kitchen"],
          isActive: true,
        })
      );

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/boats");
    });

    it("should return validation errors for missing name", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
      });

      const formData = new FormData();
      formData.append("name", "");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
    });

    it("should return validation errors for missing capacity", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          capacity: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Boat",
        capacity: "",
      });

      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("capacity", "");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("capacity", "Required");
    });

    it("should handle optional fields correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Simple Boat");
      formData.append("capacity", "6");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Simple Boat",
          capacity: 6,
          type: undefined,
          description: undefined,
          registrationNumber: undefined,
          amenities: undefined,
          isActive: false,
        })
      );
    });

    it("should parse amenities from JSON array correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Amenity Boat");
      formData.append("capacity", "10");
      // Amenities should be passed as comma-separated string, then converted to JSON by validation
      formData.append("amenities", "WiFi, AC, Kitchen");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          amenities: ["WiFi", "AC", "Kitchen"],
        })
      );
    });

    it("should parse numeric capacity correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Large Boat");
      formData.append("capacity", "20");
      formData.append("crewSize", "5");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Large Boat",
          capacity: 20,
        })
      );
    });

    it("should handle invalid type validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          type: "Invalid boat type",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Boat",
        type: "invalid-type",
      });

      const formData = new FormData();
      formData.append("name", "Test Boat");
      formData.append("type", "invalid-type");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("type", "Invalid boat type");
    });

    it("should handle isActive checkbox", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Active Boat");
      formData.append("capacity", "10");
      formData.append("isActive", "true");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          isActive: true,
        })
      );
    });

    it("should handle empty amenities string", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createBoat).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "No Amenities Boat");
      formData.append("capacity", "8");
      formData.append("amenities", "");

      const request = new Request("http://test.com/tenant/boats/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBoat).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          amenities: undefined,
        })
      );
    });
  });
});
