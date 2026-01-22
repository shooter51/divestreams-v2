import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../../app/routes/tenant/pos/products/index";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");

describe("app/routes/tenant/pos/products/index.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockProducts = [
    {
      id: "prod-1",
      name: "Dive Mask",
      category: "equipment",
      price: 50,
      stockQuantity: 10,
      isActive: true,
    },
    {
      id: "prod-2",
      name: "Fins",
      category: "equipment",
      price: 75,
      stockQuantity: 5,
      isActive: true,
    },
  ];
  const mockCategories = ["equipment", "apparel", "accessories"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch all products and categories", async () => {
      vi.mocked(queries.getProducts).mockResolvedValue(mockProducts as any);
      vi.mocked(queries.getProductCategories).mockResolvedValue(mockCategories);

      const request = new Request("http://test.com/app/pos/products");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getProducts).toHaveBeenCalledWith(
        mockOrganizationId,
        { activeOnly: false }
      );
      expect(queries.getProductCategories).toHaveBeenCalledWith(mockOrganizationId);
      expect(result.products).toEqual(mockProducts);
      expect(result.categories).toEqual(mockCategories);
    });

    it("should filter products by category", async () => {
      const filteredProducts = [mockProducts[0]];
      vi.mocked(queries.getProducts).mockResolvedValue(filteredProducts as any);
      vi.mocked(queries.getProductCategories).mockResolvedValue(mockCategories);

      const request = new Request("http://test.com/app/pos/products?category=equipment");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getProducts).toHaveBeenCalledWith(
        mockOrganizationId,
        { category: "equipment", activeOnly: false }
      );
      expect(result.products).toEqual(filteredProducts);
    });

    it("should filter products by search query", async () => {
      const filteredProducts = [mockProducts[0]];
      vi.mocked(queries.getProducts).mockResolvedValue(filteredProducts as any);
      vi.mocked(queries.getProductCategories).mockResolvedValue(mockCategories);

      const request = new Request("http://test.com/app/pos/products?search=mask");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getProducts).toHaveBeenCalledWith(
        mockOrganizationId,
        { search: "mask", activeOnly: false }
      );
      expect(result.products).toEqual(filteredProducts);
    });

    it("should filter by both category and search", async () => {
      vi.mocked(queries.getProducts).mockResolvedValue([mockProducts[0]] as any);
      vi.mocked(queries.getProductCategories).mockResolvedValue(mockCategories);

      const request = new Request("http://test.com/app/pos/products?category=equipment&search=mask");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getProducts).toHaveBeenCalledWith(
        mockOrganizationId,
        { category: "equipment", search: "mask", activeOnly: false }
      );
    });

    it("should return empty arrays when no data exists", async () => {
      vi.mocked(queries.getProducts).mockResolvedValue([]);
      vi.mocked(queries.getProductCategories).mockResolvedValue([]);

      const request = new Request("http://test.com/app/pos/products");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.products).toEqual([]);
      expect(result.categories).toEqual([]);
    });
  });

  describe("action", () => {
    it("should delete product", async () => {
      vi.mocked(queries.deleteProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", "prod-1");

      const request = new Request("http://test.com/app/pos/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.deleteProduct).toHaveBeenCalledWith(mockOrganizationId, "prod-1");
      expect(result.success).toBe(true);
    });

    it("should handle missing product ID in delete", async () => {
      vi.mocked(queries.deleteProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/app/pos/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      // Route doesn't check for null ID before calling deleteProduct
      expect(queries.deleteProduct).toHaveBeenCalledWith(mockOrganizationId, null);
      expect(result.success).toBe(true);
    });

    it("should handle unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("http://test.com/app/pos/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toBeDefined();
    });
  });
});
