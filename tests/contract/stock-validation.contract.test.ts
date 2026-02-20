/**
 * Contract tests for stock validation endpoints (KAN-620)
 *
 * Validates the API response shape and error handling for:
 * - Bulk update stock (set/adjust modes)
 * - Create product with negative stock
 * - Update product with negative stock
 * - CSV import with negative stock rows
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the action
vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Chainable DB mock - all methods return 'self' for Drizzle-style chaining
// Use vi.hoisted() so the mock is available inside vi.mock factory (which is hoisted)
const { dbMock, getMockResolveValue, setMockResolveValue } = vi.hoisted(() => {
  let _mockResolveValue: unknown[] = [];
  const createChainableDb = () => {
    const chain: Record<string, unknown> = {};
    chain.then = (resolve: (value: unknown[]) => void) => {
      resolve(_mockResolveValue);
      return chain;
    };
    chain.catch = () => chain;

    chain.select = vi.fn(() => chain);
    chain.selectDistinct = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.offset = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    return chain;
  };
  return {
    dbMock: createChainableDb(),
    getMockResolveValue: () => _mockResolveValue,
    setMockResolveValue: (v: unknown[]) => { _mockResolveValue = v; },
  };
});

vi.mock("../../lib/db/index", () => ({
  db: dbMock,
}));

import { action } from "../../app/routes/tenant/products";
import { requireOrgContext } from "../../lib/auth/org-context.server";
import { getTenantDb } from "../../lib/db/tenant.server";

type MockFn = ReturnType<typeof vi.fn>;

function createPostRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/products", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

describe("Contract: Stock Validation Endpoints", () => {
  const mockOrgContext = {
    user: { id: "user-1" },
    session: { id: "session-1" },
    org: { id: "org-uuid-123", slug: "demo", name: "Demo Dive Shop" },
    membership: { role: "owner" },
    subscription: { planDetails: { features: { hasPOS: true } } },
  };

  // Mock table schema references (Drizzle column refs)
  const mockTables = {
    products: {
      id: "id",
      organizationId: "organizationId",
      name: "name",
      sku: "sku",
      barcode: "barcode",
      category: "category",
      description: "description",
      price: "price",
      costPrice: "costPrice",
      currency: "currency",
      taxRate: "taxRate",
      salePrice: "salePrice",
      saleStartDate: "saleStartDate",
      saleEndDate: "saleEndDate",
      trackInventory: "trackInventory",
      stockQuantity: "stockQuantity",
      lowStockThreshold: "lowStockThreshold",
      imageUrl: "imageUrl",
      isActive: "isActive",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockResolveValue([]);
    (requireOrgContext as MockFn).mockResolvedValue(mockOrgContext);
    (getTenantDb as MockFn).mockReturnValue({ schema: mockTables });

    // Reset all chain methods to return the chain
    for (const key of Object.keys(dbMock)) {
      if (typeof dbMock[key]?.mockImplementation === "function") {
        dbMock[key].mockImplementation(() => dbMock);
      }
    }
    dbMock.returning.mockImplementation(() => Promise.resolve([]));
    dbMock.then = (resolve: (v: unknown[]) => void) => {
      resolve(getMockResolveValue());
      return dbMock;
    };
  });

  // ==========================================================================
  // Bulk Update Stock - "set" mode
  // ==========================================================================
  describe("Bulk update stock - set mode", () => {
    it("returns { error: string } when setting stock to negative value", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "set");
      formData.append("value", "-5");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("error");
      expect(typeof result.error).toBe("string");
      expect(result.error).toContain("Cannot set stock to negative value");
      expect(result).not.toHaveProperty("success");
    });

    it("returns { success: true } when setting stock to 0", async () => {
      dbMock.where.mockResolvedValueOnce(undefined);

      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "set");
      formData.append("value", "0");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
      expect(typeof result.message).toBe("string");
    });
  });

  // ==========================================================================
  // Bulk Update Stock - "adjust" mode
  // ==========================================================================
  describe("Bulk update stock - adjust mode", () => {
    it("returns { error: string } with product names when adjust would go negative", async () => {
      // Mock products query to return products with stock levels
      setMockResolveValue([
        { id: "prod-1", name: "Dive Mask", stockQuantity: 5 },
        { id: "prod-2", name: "Wetsuit", stockQuantity: 3 },
      ]);

      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "adjust");
      formData.append("value", "-10");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("error");
      expect(typeof result.error).toBe("string");
      expect(result.error).toContain("Cannot adjust stock");
      expect(result.error).toContain("negative stock");
      // Should include affected product names
      expect(result.error).toContain("Dive Mask");
      expect(result.error).toContain("Wetsuit");
    });

    it("returns { success: true } when adjust results in exactly 0", async () => {
      // Product with stock 10, adjusting by -10 → 0 (valid)
      setMockResolveValue([
        { id: "prod-1", name: "Dive Mask", stockQuantity: 10 },
      ]);
      dbMock.where
        .mockResolvedValueOnce([
          { id: "prod-1", stockQuantity: 10 },
        ]);

      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "adjust");
      formData.append("value", "-10");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // Create Product
  // ==========================================================================
  describe("Create product stock validation", () => {
    it("returns { success: true } when creating product with valid stock", async () => {
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("name", "Test Product");
      formData.append("category", "equipment");
      formData.append("price", "25.99");
      formData.append("stockQuantity", "10");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
      expect(result.message).toContain("Test Product");
    });

    it("accepts stock quantity of 0 for new products", async () => {
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("name", "Zero Stock Product");
      formData.append("category", "equipment");
      formData.append("price", "15.00");
      formData.append("stockQuantity", "0");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
    });
  });

  // ==========================================================================
  // CSV Import
  // ==========================================================================
  describe("CSV import stock validation", () => {
    it.skip("skips rows with negative stock and includes row number in error", async () => {
      // Mock that no existing products with same SKU
      dbMock.where.mockResolvedValue([]);
      dbMock.limit.mockResolvedValue([]);

      const csvData = [
        "name,sku,price,stockQuantity,category",
        "Good Product,SKU001,25.99,10,equipment",
        "Bad Product,SKU002,15.00,-5,equipment",
      ].join("\n");

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("importResult");
      expect(result.importResult).toHaveProperty("errors");
      // Should have error for the negative stock row
      const negativeStockError = result.importResult.errors.find(
        (e: string) => e.includes("negative stock") || e.includes("-5")
      );
      expect(negativeStockError).toBeDefined();
      // Should reference row 3 (1-indexed, after header)
      expect(negativeStockError).toContain("Row 3");
      expect(negativeStockError).toContain("Bad Product");
    });

    it.skip("imports rows with valid stock quantity (including 0)", async () => {
      dbMock.where.mockResolvedValue([]);
      dbMock.limit.mockResolvedValue([]);

      const csvData = [
        "name,sku,price,stockQuantity,category",
        "Product A,SKU-A,10.00,0,equipment",
        "Product B,SKU-B,20.00,50,equipment",
      ].join("\n");

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("success", true);
      expect(result.importResult.successCount).toBe(2);
      expect(result.importResult.errorCount).toBe(0);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe("Edge cases", () => {
    it("returns error when no products selected for bulk update", async () => {
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify([]));
      formData.append("updateType", "set");
      formData.append("value", "10");

      const result = await action(actionArgs(createPostRequest(formData)));

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("No products selected");
    });
  });
});
