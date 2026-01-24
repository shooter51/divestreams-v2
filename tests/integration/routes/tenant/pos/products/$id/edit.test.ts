import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../../../app/routes/tenant/pos/products/$id/edit";
import * as orgContext from "../../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../../lib/db/queries.server");

describe("app/routes/tenant/pos/products/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockProduct = {
    id: "prod-1",
    name: "Dive Mask",
    category: "equipment",
    price: 50,
    costPrice: 30,
    stockQuantity: 10,
    trackInventory: true,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch product", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(mockProduct as any);

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit");
      const result = await loader({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.getProductById).toHaveBeenCalledWith(mockOrganizationId, "prod-1");
      expect(result.product).toEqual(mockProduct);
    });

    it("should handle product not found", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(null);

      const request = new Request("http://test.com/tenant/pos/products/nonexistent/edit");

      await expect(
        loader({ request, params: { id: "nonexistent" }, context: {} })
      ).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("should update product and redirect", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Updated Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "55");
      formData.append("costPrice", "35");
      formData.append("stockQuantity", "15");
      formData.append("trackInventory", "on");
      formData.append("isActive", "on");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalled();
      const callArgs = vi.mocked(queries.updateProduct).mock.calls[0];
      expect(callArgs[0]).toBe(mockOrganizationId);
      expect(callArgs[1]).toBe("prod-1");
      expect(callArgs[2].name).toBe("Updated Dive Mask");
      expect(callArgs[2].category).toBe("equipment");
      expect(callArgs[2].price).toBe(55);
      expect(callArgs[2].costPrice).toBe(35);
      expect(callArgs[2].stockQuantity).toBe(15);
      expect(callArgs[2].trackInventory).toBe(true);
      expect(callArgs[2].isActive).toBe(true);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/pos/products/prod-1");
    });

    it("should return validation error for missing name", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("category", "equipment");
      formData.append("price", "50");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(result.error).toContain("required");
      expect(queries.updateProduct).not.toHaveBeenCalled();
    });

    it("should return validation error for missing category", async () => {
      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "");
      formData.append("price", "50");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(result.error).toContain("required");
      expect(queries.updateProduct).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid price", async () => {
      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "invalid");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(result.error).toContain("required");
      expect(queries.updateProduct).not.toHaveBeenCalled();
    });

    it("should handle unchecked trackInventory checkbox", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      // trackInventory not included = checkbox unchecked

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalledWith(
        mockOrganizationId,
        "prod-1",
        expect.objectContaining({
          trackInventory: false,
        })
      );
    });

    it("should handle unchecked isActive checkbox", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      // isActive not included = checkbox unchecked

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalledWith(
        mockOrganizationId,
        "prod-1",
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it("should handle optional cost field", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      formData.append("costPrice", "");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalled();
    });

    it("should handle optional stockQuantity field", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      formData.append("stockQuantity", "");

      const request = new Request("http://test.com/tenant/pos/products/prod-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalled();
    });
  });
});
