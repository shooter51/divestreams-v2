import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader } from "../../../../../app/routes/tenant/reports/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Helper to create thenable mock builder
function createMockBuilder(results: any[]) {
  let callCount = 0;
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => {
      const result = results[callCount++];
      return Promise.resolve(result).then(resolve);
    }),
  };
}

describe("app/routes/tenant/reports/index.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockOrgContext = {
    org: { id: mockOrganizationId, name: "Test Org", slug: "test-org" },
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue(mockOrgContext as any);
  });

  describe("loader", () => {
    it("should fetch report data with default date range (this_month)", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }], // Current period revenue
        [{ total: 4500 }], // Previous period revenue
        [{ total: 10000 }], // YTD revenue
        [{ count: 25 }], // Booking count
        [{ count: 150 }], // Total customers
        [{ count: 10 }], // New customers
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.currentPeriod).toBe(5000);
      expect(result.revenueOverview.previousPeriod).toBe(4500);
      expect(result.revenueOverview.yearToDate).toBe(10000);
      expect(result.revenueOverview.avgBookingValue).toBe(200);
      expect(result.revenueOverview.changePercent).toBe(11);
      expect(result.customerStats.totalCustomers).toBe(150);
      expect(result.customerStats.newInPeriod).toBe(10);
      expect(result.dateRange.preset).toBe("this_month");
      expect(result.isPremium).toBe(false);
    });

    it("should fetch report data with 'today' range", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 500 }],
        [{ total: 450 }],
        [{ total: 5000 }],
        [{ count: 5 }],
        [{ count: 100 }],
        [{ count: 2 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports?range=today");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.dateRange.preset).toBe("today");
      expect(result.dateRange.label).toBe("Today");
    });

    it("should fetch report data with 'this_week' range", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 2000 }],
        [{ total: 1800 }],
        [{ total: 8000 }],
        [{ count: 10 }],
        [{ count: 100 }],
        [{ count: 5 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports?range=this_week");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.dateRange.preset).toBe("this_week");
      expect(result.dateRange.label).toBe("This Week");
    });

    it("should fetch report data with 'this_year' range", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 50000 }],
        [{ total: 48000 }],
        [{ total: 50000 }],
        [{ count: 200 }],
        [{ count: 500 }],
        [{ count: 100 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports?range=this_year");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.dateRange.preset).toBe("this_year");
      expect(result.dateRange.label).toBe("This Year");
    });

    it("should fetch report data with custom date range", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 3000 }],
        [{ total: 2500 }],
        [{ total: 9000 }],
        [{ count: 15 }],
        [{ count: 120 }],
        [{ count: 8 }],
      ]) as any);

      const request = new Request(
        "http://test.com/tenant/reports?range=custom&start=2024-01-01&end=2024-01-31"
      );
      const result = await loader({ request, params: {}, context: {} });

      expect(result.dateRange.preset).toBe("custom");
      expect(result.dateRange.start).toBe("2024-01-01");
      expect(result.dateRange.end).toBe("2024-01-31");
      expect(result.dateRange.label).toBe("2024-01-01 to 2024-01-31");
    });

    it("should return premium features for premium users", async () => {
      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        ...mockOrgContext,
        isPremium: true,
      } as any);

      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }],
        [{ total: 4500 }],
        [{ total: 10000 }],
        [{ count: 25 }],
        [{ count: 150 }],
        [{ count: 10 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(true);
      expect(result.revenueData).toBeDefined();
      expect(result.bookingsByStatus).toBeDefined();
      expect(result.topTours).toBeDefined();
      expect(result.equipmentUtilization).toBeDefined();
    });

    it("should return empty premium features for non-premium users", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }],
        [{ total: 4500 }],
        [{ total: 10000 }],
        [{ count: 25 }],
        [{ count: 150 }],
        [{ count: 10 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(false);
      expect(result.revenueData).toEqual([]);
      expect(result.bookingsByStatus).toEqual([]);
      expect(result.topTours).toEqual([]);
      expect(result.equipmentUtilization).toEqual([]);
    });

    it("should handle zero bookings", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 0 }],
        [{ total: 0 }],
        [{ total: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.currentPeriod).toBe(0);
      expect(result.revenueOverview.avgBookingValue).toBe(0);
      expect(result.revenueOverview.changePercent).toBe(0);
      expect(result.customerStats.avgBookingsPerCustomer).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      const mockBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((resolve, reject) => {
          reject(new Error("Database error"));
          return Promise.reject(new Error("Database error"));
        }),
      };
      vi.mocked(db.select).mockReturnValue(mockBuilder as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      // Should return defaults (all zeros)
      expect(result.revenueOverview.currentPeriod).toBe(0);
      expect(result.revenueOverview.previousPeriod).toBe(0);
      expect(result.revenueOverview.yearToDate).toBe(0);
      expect(result.customerStats.totalCustomers).toBe(0);
    });

    it("should calculate percentage change correctly for positive change", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 6000 }], // Current
        [{ total: 5000 }], // Previous (20% increase)
        [{ total: 10000 }],
        [{ count: 25 }],
        [{ count: 100 }],
        [{ count: 10 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.changePercent).toBe(20);
    });

    it("should calculate percentage change correctly for negative change", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 4000 }], // Current
        [{ total: 5000 }], // Previous (20% decrease)
        [{ total: 10000 }],
        [{ count: 20 }],
        [{ count: 100 }],
        [{ count: 5 }],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.changePercent).toBe(-20);
    });
  });
});
