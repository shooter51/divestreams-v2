import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock drizzle-orm before imports
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  desc: vi.fn((field: unknown) => ({ type: "desc", field })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings: [...strings],
      values,
    })),
    { raw: vi.fn((s: string) => ({ type: "sql_raw", value: s })) }
  ),
}));

// Mock the db module
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectDistinct = vi.fn();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs);
                  return mockLimit._resolveValue;
                },
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  return { limit: (...lArgs: unknown[]) => { mockLimit(...lArgs); return mockLimit._resolveValue; } };
                },
              };
            },
            orderBy: (...oArgs: unknown[]) => {
              mockOrderBy(...oArgs);
              return { limit: (...lArgs: unknown[]) => { mockLimit(...lArgs); return mockLimit._resolveValue; } };
            },
          };
        },
      };
    },
    selectDistinct: (...args: unknown[]) => {
      mockSelectDistinct(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  return mockOrderBy._resolveValue;
                },
              };
            },
          };
        },
      };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            returning: (...rArgs: unknown[]) => {
              mockReturning(...rArgs);
              return mockReturning._resolveValue;
            },
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                returning: (...rArgs: unknown[]) => {
                  mockReturning(...rArgs);
                  return mockReturning._resolveValue;
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  products: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    sku: "sku",
    category: "category",
    stockQuantity: "stockQuantity",
    lowStockThreshold: "lowStockThreshold",
    isActive: "isActive",
    trackInventory: "trackInventory",
  },
  transactions: {
    id: "id",
    organizationId: "organizationId",
    type: "type",
    amount: "amount",
    paymentMethod: "paymentMethod",
    customerId: "customerId",
    items: "items",
    createdAt: "createdAt",
  },
  customers: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
  },
}));

vi.mock("../../../../lib/db/queries/mappers", () => ({
  mapProduct: vi.fn((p: Record<string, unknown>) => p),
}));

import {
  createProduct,
  updateProduct,
  adjustProductStock,
} from "../../../../lib/db/queries/products.server";

describe("KAN-620: Stock validation prevents negative inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: returning a valid product
    (mockReturning as any)._resolveValue = Promise.resolve([{
      id: "prod-1",
      organizationId: "org-123",
      name: "Test Product",
      sku: "TEST-001",
      category: "gear",
      price: "29.99",
      costPrice: null,
      currency: "USD",
      taxRate: "0",
      trackInventory: true,
      stockQuantity: 10,
      lowStockThreshold: 5,
      imageUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    (mockLimit as any)._resolveValue = Promise.resolve([]);
  });

  describe("createProduct - negative stock validation", () => {
    it("throws error when stockQuantity is negative", async () => {
      await expect(
        createProduct("org-123", {
          name: "Bad Product",
          category: "gear",
          price: 10,
          stockQuantity: -5,
        })
      ).rejects.toThrow("Stock quantity cannot be negative");
    });

    it("throws error when stockQuantity is -1", async () => {
      await expect(
        createProduct("org-123", {
          name: "Edge Case",
          category: "gear",
          price: 10,
          stockQuantity: -1,
        })
      ).rejects.toThrow("Stock quantity cannot be negative");
    });

    it("does not throw for stockQuantity of 0", async () => {
      await expect(
        createProduct("org-123", {
          name: "Zero Stock",
          category: "gear",
          price: 10,
          stockQuantity: 0,
        })
      ).resolves.not.toThrow();
    });

    it("does not throw for positive stockQuantity", async () => {
      await expect(
        createProduct("org-123", {
          name: "Stocked Product",
          category: "gear",
          price: 10,
          stockQuantity: 100,
        })
      ).resolves.not.toThrow();
    });

    it("does not throw when stockQuantity is undefined", async () => {
      await expect(
        createProduct("org-123", {
          name: "No Stock Specified",
          category: "gear",
          price: 10,
        })
      ).resolves.not.toThrow();
    });

    it("does not call db.insert when stockQuantity is negative", async () => {
      try {
        await createProduct("org-123", {
          name: "Bad Product",
          category: "gear",
          price: 10,
          stockQuantity: -10,
        });
      } catch {
        // Expected to throw
      }

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("updateProduct - negative stock validation", () => {
    it("throws error when updating stockQuantity to negative", async () => {
      await expect(
        updateProduct("org-123", "prod-1", { stockQuantity: -3 })
      ).rejects.toThrow("Stock quantity cannot be negative");
    });

    it("allows updating stockQuantity to 0", async () => {
      await expect(
        updateProduct("org-123", "prod-1", { stockQuantity: 0 })
      ).resolves.not.toThrow();
    });

    it("allows updating stockQuantity to positive", async () => {
      await expect(
        updateProduct("org-123", "prod-1", { stockQuantity: 50 })
      ).resolves.not.toThrow();
    });

    it("allows updates that don't include stockQuantity", async () => {
      await expect(
        updateProduct("org-123", "prod-1", { name: "Renamed" })
      ).resolves.not.toThrow();
    });

    it("does not call db.update when stockQuantity is negative", async () => {
      try {
        await updateProduct("org-123", "prod-1", { stockQuantity: -1 });
      } catch {
        // Expected
      }

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("adjustProductStock - prevents negative result", () => {
    it("returns error when adjustment would make stock negative", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Dive Mask", stockQuantity: 5 },
      ]);

      const result = await adjustProductStock("org-123", "prod-1", -10);

      expect(result.success).toBe(false);
      expect(result.error).toContain("negative stock");
      expect(result.error).toContain("-10");
      expect(result.error).toContain("-5"); // 5 + (-10) = -5
    });

    it("includes current stock in error message", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Regulator", stockQuantity: 3 },
      ]);

      const result = await adjustProductStock("org-123", "prod-1", -8);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Current stock is 3");
    });

    it("allows adjustment that brings stock exactly to 0", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Fins", stockQuantity: 5 },
      ]);
      // After adjustment, db.update is called
      (mockReturning as any)._resolveValue = Promise.resolve([]);

      const result = await adjustProductStock("org-123", "prod-1", -5);

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(0);
    });

    it("allows positive adjustment (restocking)", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Wetsuit", stockQuantity: 2 },
      ]);

      const result = await adjustProductStock("org-123", "prod-1", 10);

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(12);
    });

    it("returns error when product not found", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([]);

      const result = await adjustProductStock("org-123", "nonexistent", -1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Product not found");
    });

    it("does not update database when adjustment would go negative", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "BCD", stockQuantity: 2 },
      ]);

      await adjustProductStock("org-123", "prod-1", -5);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("error message format: includes adjustment, resulting quantity, and current stock", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Tank", stockQuantity: 3 },
      ]);

      const result = await adjustProductStock("org-123", "prod-1", -7);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/adjustment of -7/);
      expect(result.error).toMatch(/negative stock \(-4\)/);
      expect(result.error).toMatch(/Current stock is 3/);
    });
  });

  describe("stock validation - boundary values", () => {
    it("createProduct: rejects stockQuantity of -0.5 (decimal negatives)", async () => {
      // parseInt would truncate, but the validation uses < 0
      await expect(
        createProduct("org-123", {
          name: "Test",
          category: "gear",
          price: 10,
          stockQuantity: -0.5,
        })
      ).rejects.toThrow("Stock quantity cannot be negative");
    });

    it("adjustProductStock: allows adjustment of 0 (no-op)", async () => {
      (mockLimit as any)._resolveValue = Promise.resolve([
        { name: "Test", stockQuantity: 5 },
      ]);

      const result = await adjustProductStock("org-123", "prod-1", 0);

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(5);
    });

    it("createProduct: allows very large positive stockQuantity", async () => {
      await expect(
        createProduct("org-123", {
          name: "Bulk Item",
          category: "gear",
          price: 1,
          stockQuantity: 999999,
        })
      ).resolves.not.toThrow();
    });
  });
});
