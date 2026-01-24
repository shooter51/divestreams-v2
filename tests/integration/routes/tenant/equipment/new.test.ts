import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/equipment/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as validation from "../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/validation");

describe("app/routes/tenant/equipment/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("action", () => {
    it("should create equipment and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createEquipment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "BCD Pro");
      formData.append("brand", "Aqualung");
      formData.append("model", "Pro HD");
      formData.append("category", "bcd");
      formData.append("status", "available");
      formData.append("condition", "excellent");
      formData.append("isRentable", "true");
      formData.append("rentalPrice", "25.00");
      formData.append("serialNumber", "SN12345");
      formData.append("barcode", "123456789");
      formData.append("isPublic", "true");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createEquipment).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "BCD Pro",
          brand: "Aqualung",
          model: "Pro HD",
          category: "bcd",
          status: "available",
          condition: "excellent",
          isRentable: true,
          rentalPrice: 25.0,
          serialNumber: "SN12345",
          barcode: "123456789",
          isPublic: true,
        })
      );

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/equipment");
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

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
    });

    it("should return validation errors for missing category", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          category: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Equipment",
        category: "",
      });

      const formData = new FormData();
      formData.append("name", "Test Equipment");
      formData.append("category", "");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("category", "Required");
    });

    it("should handle optional fields correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createEquipment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Simple Equipment");
      formData.append("category", "other");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createEquipment).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Simple Equipment",
          category: "other",
          brand: undefined,
          model: undefined,
          serialNumber: undefined,
          barcode: undefined,
          isRentable: false,
          isPublic: false,
        })
      );
    });

    it("should parse numeric rentalPrice correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createEquipment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Rental Equipment");
      formData.append("category", "bcd");
      formData.append("isRentable", "true");
      formData.append("rentalPrice", "35.50");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createEquipment).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          rentalPrice: 35.5,
        })
      );
    });

    it("should handle invalid category validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          category: "Invalid category",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Equipment",
        category: "invalid-category",
      });

      const formData = new FormData();
      formData.append("name", "Test Equipment");
      formData.append("category", "invalid-category");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("category", "Invalid category");
    });

    it("should handle invalid status validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          status: "Invalid status",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Equipment",
        status: "invalid-status",
      });

      const formData = new FormData();
      formData.append("name", "Test Equipment");
      formData.append("status", "invalid-status");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("status", "Invalid status");
    });

    it("should handle size field", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      vi.mocked(queries.createEquipment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Wetsuit");
      formData.append("category", "wetsuit");
      formData.append("size", "L");

      const request = new Request("http://test.com/app/equipment/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createEquipment).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Wetsuit",
          category: "wetsuit",
          size: "L",
        })
      );
    });
  });
});
