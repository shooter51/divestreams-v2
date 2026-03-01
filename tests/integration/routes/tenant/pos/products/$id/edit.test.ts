import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../../helpers/redirect";
import { loader, action } from "../../../../../../../app/routes/tenant/pos/products/$id/edit";
import * as orgContext from "../../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../../lib/db/queries.server");
vi.mock("../../../../../../../lib/db/tenant.server");

describe("app/routes/tenant/pos/products/$id/edit.tsx", () => {
  const mockOrganizationId = "123e4567-e89b-12d3-a456-426614174000";
  const mockProductId = "223e4567-e89b-12d3-a456-426614174001";
  const mockProduct = {
    id: mockProductId,
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
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as unknown);

    // Mock getTenantDb for loader (which fetches product images)
    const mockSelectBuilder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(tenantServer.getTenantDb).mockReturnValue({
      db: { select: vi.fn().mockReturnValue(mockSelectBuilder) },
      schema: {
        images: {
          id: "id",
          url: "url",
          thumbnailUrl: "thumbnail_url",
          filename: "filename",
          width: "width",
          height: "height",
          alt: "alt",
          sortOrder: "sort_order",
          isPrimary: "is_primary",
          organizationId: "organization_id",
          entityType: "entity_type",
          entityId: "entity_id",
        },
      },
    } as unknown);
  });

  describe("loader", () => {
    it("should fetch product", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(mockProduct as unknown);

      const request = new Request(`http://test.com/tenant/pos/products/${mockProductId}/edit`);
      const result = await loader({ request, params: { id: mockProductId }, context: {} });

      expect(queries.getProductById).toHaveBeenCalledWith(mockOrganizationId, mockProductId);
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

      const request = new Request(`http://test.com/tenant/pos/products/${mockProductId}/edit`, {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockProductId }, context: {} });

      expect(queries.updateProduct).toHaveBeenCalled();
      const callArgs = vi.mocked(queries.updateProduct).mock.calls[0];
      expect(callArgs[0]).toBe(mockOrganizationId);
      expect(callArgs[1]).toBe(mockProductId);
      expect(callArgs[2].name).toBe("Updated Dive Mask");
      expect(callArgs[2].category).toBe("equipment");
      expect(callArgs[2].price).toBe(55);
      expect(callArgs[2].costPrice).toBe(35);
      expect(callArgs[2].stockQuantity).toBe(15);
      expect(callArgs[2].trackInventory).toBe(true);
      expect(callArgs[2].isActive).toBe(true);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/pos/products/${mockProductId}`);
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
