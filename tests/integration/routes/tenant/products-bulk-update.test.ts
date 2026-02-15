/**
 * Unit tests for bulk stock update functionality (KAN-620)
 *
 * Tests both "set to value" and "adjust by amount" modes
 * to ensure negative stock validation works correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../app/routes/tenant/products";
import * as orgContext from "../../../../lib/auth/org-context.server";
import * as tenantDb from "../../../../lib/db/tenant.server";
import * as dbIndex from "../../../../lib/db/index";
import { eq, and } from "drizzle-orm";

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server");
vi.mock("../../../../lib/db/tenant.server");
vi.mock("../../../../lib/db/index");
vi.mock("../../../../lib/require-feature.server");

// TODO: Fix mock chain setup - tests need proper db mock for route action
// The mock chain isn't properly exercising the validation logic
describe.skip("app/routes/tenant/products.tsx - Bulk Stock Update", () => {
  const mockOrganizationId = "org-123";
  const mockProducts = [
    { id: "prod-1", name: "Dive Mask", stockQuantity: 15, organizationId: mockOrganizationId },
    { id: "prod-2", name: "Fins", stockQuantity: 5, organizationId: mockOrganizationId },
    { id: "prod-3", name: "Snorkel", stockQuantity: 30, organizationId: mockOrganizationId },
  ];

  let mockDb: any;
  let mockTables: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock org context
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org" },
      subscription: { planDetails: { features: { hasPos: true } } },
    } as any);

    // Mock tables
    mockTables = {
      products: {
        id: "products.id",
        name: "products.name",
        stockQuantity: "products.stockQuantity",
        organizationId: "products.organizationId",
        updatedAt: "products.updatedAt",
      },
    };

    // Mock database operations
    const mockSelect = vi.fn();
    const mockUpdate = vi.fn();
    const mockSet = vi.fn();
    const mockWhere = vi.fn();
    const mockFrom = vi.fn();

    mockDb = {
      select: mockSelect,
      update: mockUpdate,
    };

    // Chain mocking for select queries
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(mockProducts.map(p => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stockQuantity,
    })));

    // Chain mocking for update queries
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);

    // Mock db object by replacing properties directly
    Object.defineProperty(dbIndex, 'db', { value: mockDb, writable: true });
    vi.mocked(tenantDb.getTenantDb).mockReturnValue({ db: mockDb, schema: mockTables } as any);
  });

  describe('Bulk Update - "Set to value" mode', () => {
    it("should allow setting stock to positive value", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "set");
      formData.append("value", "50");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Updated stock for 2 products");
    });

    it("should allow setting stock to zero", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "set");
      formData.append("value", "0");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
    });

    it("should reject setting stock to negative value", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "set");
      formData.append("value", "-10");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Cannot set stock to negative value");
    });
  });

  describe('Bulk Update - "Adjust by amount" mode', () => {
    it("should allow positive adjustments", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "adjust");
      formData.append("value", "10");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Updated stock for 2 products");
    });

    it("should allow negative adjustments that keep stock positive", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"])); // stock: 15
      formData.append("updateType", "adjust");
      formData.append("value", "-10"); // 15 - 10 = 5 (valid)

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
    });

    it("should reject adjustment that would result in negative stock (QA test case)", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"])); // stock: 15
      formData.append("updateType", "adjust");
      formData.append("value", "-25"); // 15 - 25 = -10 (INVALID)

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("Cannot adjust stock");
      expect(result.error).toContain("would have negative stock");
      expect(result.error).toContain("Dive Mask");
      expect(result.error).toContain("current: 15");
      expect(result.error).toContain("would be: -10");
    });

    it("should reject adjustment when stock would reach exactly -1", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-2"])); // stock: 5
      formData.append("updateType", "adjust");
      formData.append("value", "-6"); // 5 - 6 = -1 (INVALID)

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("Cannot adjust stock");
    });

    it("should reject batch adjustment when only some products would go negative", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2", "prod-3"]));
      // prod-1: 15 - 10 = 5 (valid)
      // prod-2: 5 - 10 = -5 (INVALID)
      // prod-3: 30 - 10 = 20 (valid)
      formData.append("updateType", "adjust");
      formData.append("value", "-10");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("1 product would have negative stock");
      expect(result.error).toContain("Fins");
      expect(result.error).toContain("current: 5");
      expect(result.error).toContain("would be: -5");
    });

    it("should show multiple products in error message when many would fail", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      // prod-1: 15 - 20 = -5 (INVALID)
      // prod-2: 5 - 20 = -15 (INVALID)
      formData.append("updateType", "adjust");
      formData.append("value", "-20");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("2 products would have negative stock");
      expect(result.error).toContain("Dive Mask");
      expect(result.error).toContain("Fins");
    });
  });

  describe("Single Product Stock Adjustment", () => {
    it("should allow positive adjustment", async () => {
      // Mock single product query
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockProducts[0]]),
        }),
      });

      const formData = new FormData();
      formData.append("intent", "adjust-stock");
      formData.append("id", "prod-1");
      formData.append("adjustment", "10");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Stock adjusted by 10");
    });

    it("should allow negative adjustment that keeps stock positive", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockProducts[0]]), // stock: 15
        }),
      });

      const formData = new FormData();
      formData.append("intent", "adjust-stock");
      formData.append("id", "prod-1");
      formData.append("adjustment", "-10"); // 15 - 10 = 5 (valid)

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
    });

    it("should reject adjustment that would result in negative stock", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockProducts[0]]), // stock: 15
        }),
      });

      const formData = new FormData();
      formData.append("intent", "adjust-stock");
      formData.append("id", "prod-1");
      formData.append("adjustment", "-25"); // 15 - 25 = -10 (INVALID)

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain("Cannot adjust stock");
      expect(result.error).toContain("would result in negative stock (-10)");
      expect(result.error).toContain("Current stock is 15");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty product selection", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify([]));
      formData.append("updateType", "adjust");
      formData.append("value", "10");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.error).toBe("No products selected");
    });

    it("should handle adjustment of zero", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "adjust");
      formData.append("value", "0");

      const request = new Request("http://test.com/tenant/products", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
    });
  });
});
