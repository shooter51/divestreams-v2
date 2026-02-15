import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/pos/products/new";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");

describe("app/routes/tenant/pos/products/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as any);
  });

  describe("action", () => {
    it("should create product and redirect", async () => {
      const mockProduct = { id: "prod-123" };
      vi.mocked(queries.createProduct).mockResolvedValue(mockProduct as any);

      const formData = new FormData();
      formData.append("name", "New Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      formData.append("costPrice", "30");
      formData.append("stockQuantity", "10");
      formData.append("trackInventory", "on");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createProduct).toHaveBeenCalled();
      const callArgs = vi.mocked(queries.createProduct).mock.calls[0];
      expect(callArgs[0]).toBe(mockOrganizationId);
      expect(callArgs[1].name).toBe("New Dive Mask");
      expect(callArgs[1].category).toBe("equipment");
      expect(callArgs[1].price).toBe(50);
      expect(callArgs[1].costPrice).toBe(30);
      expect(callArgs[1].stockQuantity).toBe(10);
      expect(callArgs[1].trackInventory).toBe(true);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/pos/products/prod-123");
    });

    it("should return validation error for missing name", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("category", "equipment");
      formData.append("price", "50");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.error).toContain("required");
      expect(queries.createProduct).not.toHaveBeenCalled();
    });

    it("should return validation error for missing category", async () => {
      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "");
      formData.append("price", "50");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.error).toContain("required");
      expect(queries.createProduct).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid price", async () => {
      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "invalid");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.error).toContain("required");
      expect(queries.createProduct).not.toHaveBeenCalled();
    });

    it("should handle unchecked trackInventory checkbox", async () => {
      const mockProduct = { id: "prod-123" };
      vi.mocked(queries.createProduct).mockResolvedValue(mockProduct as any);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      // trackInventory not included = checkbox unchecked

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createProduct).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          trackInventory: false,
        })
      );
    });

    it("should handle optional cost field", async () => {
      const mockProduct = { id: "prod-123" };
      vi.mocked(queries.createProduct).mockResolvedValue(mockProduct as any);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      formData.append("cost", "");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createProduct).toHaveBeenCalled();
    });

    it("should handle optional stockQuantity field", async () => {
      const mockProduct = { id: "prod-123" };
      vi.mocked(queries.createProduct).mockResolvedValue(mockProduct as any);

      const formData = new FormData();
      formData.append("name", "Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "50");
      formData.append("stockQuantity", "");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createProduct).toHaveBeenCalled();
    });

    it("should handle all fields provided", async () => {
      const mockProduct = { id: "prod-123" };
      vi.mocked(queries.createProduct).mockResolvedValue(mockProduct as any);

      const formData = new FormData();
      formData.append("name", "Premium Dive Mask");
      formData.append("category", "equipment");
      formData.append("price", "75");
      formData.append("costPrice", "40");
      formData.append("stockQuantity", "20");
      formData.append("trackInventory", "on");
      formData.append("description", "High-quality mask");

      const request = new Request("http://test.com/tenant/pos/products/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createProduct).toHaveBeenCalled();
      const callArgs = vi.mocked(queries.createProduct).mock.calls[0];
      expect(callArgs[1].name).toBe("Premium Dive Mask");
      expect(callArgs[1].price).toBe(75);
      expect(callArgs[1].costPrice).toBe(40);
      expect(callArgs[1].description).toBe("High-quality mask");
    });
  });
});
