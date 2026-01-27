import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/pos/products/$id";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");

describe("app/routes/tenant/pos/products/$id.tsx", () => {
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
    it("should fetch product by ID", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(mockProduct as any);

      const request = new Request("http://test.com/tenant/pos/products/prod-1");
      const result = await loader({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.getProductById).toHaveBeenCalledWith(mockOrganizationId, "prod-1");
      expect(result.product).toEqual(mockProduct);
    });

    it("should handle product not found", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(null);

      const request = new Request("http://test.com/tenant/pos/products/nonexistent");

      await expect(
        loader({ request, params: { id: "nonexistent" }, context: {} })
      ).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("should delete product and redirect", async () => {
      vi.mocked(queries.deleteProduct).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/tenant/pos/products/prod-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.deleteProduct).toHaveBeenCalledWith(mockOrganizationId, "prod-1");
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/pos/products");
    });

    it("should adjust stock up", async () => {
      vi.mocked(queries.adjustProductStock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "adjustStock");
      formData.append("adjustment", "5");

      const request = new Request("http://test.com/tenant/pos/products/prod-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.adjustProductStock).toHaveBeenCalledWith(mockOrganizationId, "prod-1", 5);
      expect(result.success).toBe(true);
    });

    it("should adjust stock down", async () => {
      vi.mocked(queries.adjustProductStock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "adjustStock");
      formData.append("adjustment", "-3");

      const request = new Request("http://test.com/tenant/pos/products/prod-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.adjustProductStock).toHaveBeenCalledWith(mockOrganizationId, "prod-1", -3);
      expect(result.success).toBe(true);
    });

    it("should handle invalid adjustment value", async () => {
      vi.mocked(queries.adjustProductStock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "adjustStock");
      formData.append("adjustment", "invalid");

      const request = new Request("http://test.com/tenant/pos/products/prod-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      // parseInt("invalid") = NaN, still calls function with NaN      expect(result.success).toBe(true);
    });

    it("should handle zero adjustment", async () => {
      vi.mocked(queries.adjustProductStock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "adjustStock");
      formData.append("adjustment", "0");

      const request = new Request("http://test.com/tenant/pos/products/prod-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "prod-1" }, context: {} });

      expect(queries.adjustProductStock).toHaveBeenCalledWith(mockOrganizationId, "prod-1", 0);
    });
  });
});
