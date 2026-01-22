/**
 * Tenant Products Route Tests
 *
 * Tests product management (inventory for POS).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/products";

// Mock tenant auth
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock tenant db
vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import mocked modules
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db";

describe("Route: tenant/products.tsx", () => {
  const mockTables = {
    products: {
      id: "id",
      name: "name",
      sku: "sku",
      category: "category",
      description: "description",
      price: "price",
      costPrice: "costPrice",
      currency: "currency",
      taxRate: "taxRate",
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

    // Default mocks
    (requireTenant as any).mockResolvedValue({
      tenant: {
        id: "org-123",
        subdomain: "diveshop",
      },
      organizationId: "org-123",
    });

    (getTenantDb as any).mockReturnValue({
      schema: mockTables,
    });
  });

  describe("loader", () => {
    it("should load products successfully", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/products");

      const mockProducts = [
        {
          id: "prod-1",
          name: "Dive Mask",
          sku: "MASK001",
          category: "equipment",
          price: "50.00",
          stockQuantity: 10,
        },
        {
          id: "prod-2",
          name: "Fins",
          sku: "FINS001",
          category: "equipment",
          price: "75.00",
          stockQuantity: 5,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockProducts),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.subdomain).toBe("diveshop");
      expect(result.products).toEqual(mockProducts);
      expect(result.migrationNeeded).toBe(false);
    });

    it("should fallback to basic query if full query fails", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/products");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockBasicProducts = [
        {
          id: "prod-1",
          name: "Dive Mask",
          sku: "MASK001",
          category: "equipment",
          price: "50.00",
          stockQuantity: 10,
        },
      ];

      // First query fails (sale_price columns don't exist)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error("column sale_price does not exist")),
        }),
      });

      // Second query succeeds (basic query without sale fields)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockBasicProducts),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.products).toEqual(mockBasicProducts);
      expect(result.migrationNeeded).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Products query failed, trying basic query:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return empty products array if both queries fail", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/products");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Both queries fail
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error("Table does not exist")),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.products).toEqual([]);
      expect(result.migrationNeeded).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Basic products query also failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("action - create", () => {
    it("should create product successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("name", "Wetsuit");
      formData.append("category", "equipment");
      formData.append("price", "200.00");
      formData.append("sku", "WET001");
      formData.append("stockQuantity", "15");
      formData.append("costPrice", "120.00");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({ values: mockValues });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Product created");
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "diveshop",
          name: "Wetsuit",
          category: "equipment",
          price: "200.00",
          sku: "WET001",
          stockQuantity: 15,
          costPrice: "120.00",
          trackInventory: true,
          isActive: true,
        })
      );
    });

    it("should create product with sale dates", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("name", "Clearance Fins");
      formData.append("category", "equipment");
      formData.append("price", "75.00");
      formData.append("sku", "FINS-SALE");
      formData.append("salePrice", "50.00");
      formData.append("saleStartDate", "2024-01-01");
      formData.append("saleEndDate", "2024-01-31");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({ values: mockValues });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          salePrice: "50.00",
          saleStartDate: new Date("2024-01-01"),
          saleEndDate: new Date("2024-01-31"),
        })
      );
    });
  });

  describe("action - update", () => {
    it("should update product successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "prod-123");
      formData.append("name", "Updated Mask");
      formData.append("category", "equipment");
      formData.append("price", "55.00");
      formData.append("sku", "MASK002");
      formData.append("isActive", "true");
      formData.append("stockQuantity", "20");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockSet = vi.fn();
      const mockWhere = vi.fn();
      (db.update as any).mockReturnValue({
        set: mockSet.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Product updated");
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Mask",
          price: "55.00",
          isActive: true,
          stockQuantity: 20,
        })
      );
    });
  });

  describe("action - adjust-stock", () => {
    it("should adjust stock quantity correctly", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "adjust-stock");
      formData.append("id", "prod-123");
      formData.append("adjustment", "10");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock product lookup
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "prod-123", stockQuantity: 15 },
          ]),
        }),
      });

      const mockSet = vi.fn();
      const mockWhere = vi.fn();
      (db.update as any).mockReturnValue({
        set: mockSet.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Stock adjusted by 10");
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stockQuantity: 25, // 15 + 10
        })
      );
    });

    it("should prevent negative stock quantities", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "adjust-stock");
      formData.append("id", "prod-123");
      formData.append("adjustment", "-20");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock product with 15 items
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "prod-123", stockQuantity: 15 },
          ]),
        }),
      });

      const mockSet = vi.fn();
      (db.update as any).mockReturnValue({
        set: mockSet.mockReturnValue({
          where: vi.fn(),
        }),
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      // 15 + (-20) = -5, but Math.max(0, -5) = 0
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stockQuantity: 0,
        })
      );
    });
  });

  describe("action - delete", () => {
    it("should delete product successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", "prod-123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockWhere = vi.fn();
      (db.delete as any).mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Product deleted");
      expect(db.delete).toHaveBeenCalledWith(mockTables.products);
    });
  });

  describe("action - bulk-update-stock", () => {
    it("should set stock to specific value for multiple products", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "set");
      formData.append("value", "100");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockSet = vi.fn();
      (db.update as any).mockReturnValue({
        set: mockSet.mockReturnValue({
          where: vi.fn(),
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Updated stock for 2 products");
      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stockQuantity: 100,
        })
      );
    });

    it("should adjust stock for multiple products", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1", "prod-2"]));
      formData.append("updateType", "adjust");
      formData.append("value", "10");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock product lookups
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "prod-1", stockQuantity: 5 },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "prod-2", stockQuantity: 8 },
            ]),
          }),
        });

      const mockSet = vi.fn();
      (db.update as any).mockReturnValue({
        set: mockSet.mockReturnValue({
          where: vi.fn(),
        }),
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 15 }) // 5 + 10
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 18 }) // 8 + 10
      );
    });

    it("should return error if no products selected", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify([]));
      formData.append("updateType", "set");
      formData.append("value", "10");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("No products selected");
    });

    it("should use singular 'product' in message when updating 1 product", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "bulk-update-stock");
      formData.append("productIds", JSON.stringify(["prod-1"]));
      formData.append("updateType", "set");
      formData.append("value", "50");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn(),
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.message).toBe("Updated stock for 1 product");
    });
  });

  describe("action - import-csv", () => {
    it("should import valid CSV successfully", async () => {
      // Arrange
      const csvData = `name,sku,price,stockQuantity
Dive Mask,MASK001,50.00,10
Fins,FINS001,75.00,5`;

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({ values: mockValues });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Imported 2 products");
      expect(result.importResult?.successCount).toBe(2);
      expect(result.importResult?.errorCount).toBe(0);
      expect(mockValues).toHaveBeenCalledTimes(2);
    });

    it("should return error for missing CSV data", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "import-csv");
      // csvData not appended

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("No CSV data provided");
    });

    it("should return error for CSV without data rows", async () => {
      // Arrange
      const csvData = "name,sku,price,stockQuantity";

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("CSV must have a header row and at least one data row");
    });

    it("should return error for missing required columns", async () => {
      // Arrange
      const csvData = `name,sku
Dive Mask,MASK001`;

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toContain("Missing required columns:");
      expect(result.error).toContain("price");
      expect(result.error).toContain("stockquantity");
    });

    it("should validate required fields in data rows", async () => {
      // Arrange
      const csvData = `name,sku,price,stockQuantity
,MASK001,50.00,10
Fins,,75.00,5
BCD,BCD001,invalid,3
Tank,TANK001,100.00,invalid`;

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({ values: mockValues });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.importResult?.errorCount).toBe(4);
      expect(result.importResult?.errors).toContain("Row 2: Missing required field 'name'");
      expect(result.importResult?.errors).toContain("Row 3: Missing required field 'sku'");
      expect(result.importResult?.errors).toContain("Row 4: Invalid or missing 'price'");
      expect(result.importResult?.errors).toContain("Row 5: Invalid or missing 'stockQuantity'");
    });

    it("should default invalid categories to 'other'", async () => {
      // Arrange
      const csvData = `name,sku,price,stockQuantity,category
Mask,MASK001,50.00,10,invalid_category
Fins,FINS001,75.00,5,equipment`;

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({ values: mockValues });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.importResult?.errors).toContain("Row 2: Invalid category 'invalid_category', using 'other'");
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ category: "other" })
      );
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ category: "equipment" })
      );
    });

    it("should handle database errors during import", async () => {
      // Arrange
      const csvData = `name,sku,price,stockQuantity
Mask,MASK001,50.00,10`;

      const formData = new FormData();
      formData.append("intent", "import-csv");
      formData.append("csvData", csvData);

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("Duplicate SKU")),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.importResult?.errorCount).toBe(1);
      expect(result.importResult?.errors).toContain("Row 2: Database error - Duplicate SKU");
    });
  });

  describe("action - invalid intent", () => {
    it("should return error for invalid intent", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Invalid intent");
    });
  });
});
