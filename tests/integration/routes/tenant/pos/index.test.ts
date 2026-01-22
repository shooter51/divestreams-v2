import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/pos/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("app/routes/tenant/pos/index.tsx", () => {
  const mockOrg = { id: "org-123", name: "Test Org" };
  const mockProducts = [
    { id: "prod-1", name: "Dive Mask", price: 50, category: "equipment" },
    { id: "prod-2", name: "Fins", price: 75, category: "equipment" },
  ];
  const mockCategories = ["equipment", "apparel"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return upgrade message for non-premium tenants", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: false },
      } as any);

      const request = new Request("http://test.com/app/pos");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(false);
      expect(result.requiresUpgrade).toBe(true);
      expect(result.products).toEqual([]);
      expect(result.categories).toEqual([]);
    });

    it("should load POS data for premium tenants", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: true },
      } as any);

      // Mock products query
      const mockProductsSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockProducts),
      };

      // Mock sales summary query
      const mockSalesSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ totalSales: 100, transactionCount: 5 }]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockProductsSelectBuilder as any;
        } else {
          return mockSalesSelectBuilder as any;
        }
      });

      const request = new Request("http://test.com/app/pos");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(true);
      expect(result.products).toHaveLength(2);
      expect(result.categories).toEqual(["equipment"]);
      expect(result.summary).toBeDefined();
    });

    it("should calculate today's sales summary", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: true },
      } as any);

      const mockProductsSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      const mockSalesSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ totalSales: 250, transactionCount: 10 }]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockProductsSelectBuilder as any;
        } else {
          return mockSalesSelectBuilder as any;
        }
      });

      const request = new Request("http://test.com/app/pos");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.summary).toHaveProperty("totalSales");
      expect(result.summary).toHaveProperty("transactionCount");
    });
  });

  describe("action", () => {
    it("should reject checkout for non-premium tenants", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: false },
      } as any);

      const formData = new FormData();
      formData.append("intent", "checkout");
      formData.append("items", JSON.stringify([{ id: "prod-1", quantity: 1, price: 50 }]));
      formData.append("paymentMethod", "cash");

      const request = new Request("http://test.com/app/pos", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.error).toContain("premium feature");
    });

    it("should process checkout and adjust stock", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: true },
      } as any);

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "txn-123" }]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.insert).mockReturnValue(mockInsertBuilder as any);
      vi.mocked(db.update).mockReturnValue(mockUpdateBuilder as any);

      const items = [
        { id: "prod-1", name: "Dive Mask", quantity: 2, price: 50, trackInventory: true },
      ];

      const formData = new FormData();
      formData.append("intent", "checkout");
      formData.append("items", JSON.stringify(items));
      formData.append("paymentMethod", "card");
      formData.append("total", "100");

      const request = new Request("http://test.com/app/pos", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("txn-123");
    });

    it("should handle different payment methods", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: true },
      } as any);

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "txn-123" }]),
      };

      vi.mocked(db.insert).mockReturnValue(mockInsertBuilder as any);

      const items = [{ id: "prod-1", name: "Product", quantity: 1, price: 50, trackInventory: false }];

      for (const method of ["cash", "card", "other"]) {
        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("items", JSON.stringify(items));
        formData.append("paymentMethod", method);
        formData.append("total", "50");

        const request = new Request("http://test.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        expect(result.success).toBe(true);
      }
    });

    it("should skip stock adjustment for non-tracked items", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: mockOrg,
        limits: { hasPOS: true },
      } as any);

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "txn-123" }]),
      };

      vi.mocked(db.insert).mockReturnValue(mockInsertBuilder as any);

      const items = [
        { id: "prod-1", name: "Product", quantity: 1, price: 50, trackInventory: false },
      ];

      const formData = new FormData();
      formData.append("intent", "checkout");
      formData.append("items", JSON.stringify(items));
      formData.append("paymentMethod", "cash");
      formData.append("total", "50");

      const request = new Request("http://test.com/app/pos", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result.success).toBe(true);
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
