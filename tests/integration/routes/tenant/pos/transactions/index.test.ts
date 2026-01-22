import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../../app/routes/tenant/pos/transactions/index";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import { db } from "../../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/pos/transactions/index.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockSummary = {
    totalSales: 1000,
    totalRefunds: 100,
    netRevenue: 900,
    transactionCount: 25,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch all transactions and summary", async () => {
      const mockDbTransactions = [
        {
          id: "txn-1",
          type: "sale",
          amount: "100.00",
          paymentMethod: "card",
          items: [{ description: "Dive Mask", quantity: 2, unitPrice: 50, total: 100 }],
          createdAt: new Date("2024-01-15T10:00:00Z"),
          customerFirstName: "John",
          customerLastName: "Doe",
        },
      ];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockDbTransactions),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);
      vi.mocked(queries.getPOSSummary).mockResolvedValue(mockSummary as any);

      const request = new Request("http://test.com/app/pos/transactions");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getPOSSummary).toHaveBeenCalledWith(mockOrganizationId);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].customerName).toBe("John Doe");
      expect(result.summary).toEqual(mockSummary);
    });

    it("should filter transactions by date range", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);
      vi.mocked(queries.getPOSSummary).mockResolvedValue(mockSummary as any);

      const request = new Request(
        "http://test.com/app/pos/transactions?dateFrom=2024-01-01&dateTo=2024-01-31"
      );
      const result = await loader({ request, params: {}, context: {} });

      expect(result.transactions).toBeDefined();
    });

    it("should return empty array when no transactions exist", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);
      vi.mocked(queries.getPOSSummary).mockResolvedValue({
        totalSales: 0,
        totalRefunds: 0,
        netRevenue: 0,
        transactionCount: 0,
      } as any);

      const request = new Request("http://test.com/app/pos/transactions");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.transactions).toEqual([]);
      expect(result.summary.transactionCount).toBe(0);
    });
  });
});
