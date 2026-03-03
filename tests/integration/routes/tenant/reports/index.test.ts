import { describe, it, expect, vi, beforeEach } from "vitest";
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
function createMockBuilder(results: unknown[]) {
  let callCount = 0;
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => {
      const result = results[callCount++];
      return Promise.resolve(result).then(resolve);
    }),
  };
  return builder;
}

describe("app/routes/tenant/reports/index.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockOrgContext = {
    org: { id: mockOrganizationId, name: "Test Org", slug: "test-org" },
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue(mockOrgContext as unknown);
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
      ]) as unknown);

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
      ]) as unknown);

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
      ]) as unknown);

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
      ]) as unknown);

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
      ]) as unknown);

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
      } as unknown);

      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }],
        [{ total: 4500 }],
        [{ total: 10000 }],
        [{ count: 25 }],
        [{ count: 150 }],
        [{ count: 10 }],
        // Premium queries: revenueData, bookingsByStatus, topTours, equipmentRaw
        [{ period: "2024-01-01", revenue: 1000, bookings: 5 }],
        [{ status: "confirmed", count: 10 }],
        [{ id: "tour-1", name: "Reef Dive", bookings: 5, revenue: 500 }],
        [{ category: "wetsuit", status: "available", count: 3 }],
      ]) as unknown);

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
      ]) as unknown);

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
      ]) as unknown);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.currentPeriod).toBe(0);
      expect(result.revenueOverview.avgBookingValue).toBe(0);
      expect(result.revenueOverview.changePercent).toBe(0);
      expect(result.customerStats.avgBookingsPerCustomer).toBe(0);
    });

    // DS-hn1a: When current period has no bookings, fall back to all-time avg
    it("should fall back to all-time avg booking value when period has no bookings", async () => {
      // Query order when bookingsInPeriod==0:
      // 1. current period revenue, 2. previous period, 3. YTD, 4. booking count (→ 0)
      // 5. all-time fallback (fires because count==0)
      // 6. total customers, 7. new customers
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 0 }],              // query 1: current period revenue
        [{ total: 0 }],              // query 2: previous period revenue
        [{ total: 5000 }],           // query 3: YTD revenue
        [{ count: 0 }],              // query 4: booking count → triggers fallback
        [{ total: 1500, count: 5 }], // query 5: all-time fallback ($1500/5 = $300)
        [{ count: 10 }],             // query 6: total customers
        [{ count: 0 }],              // query 7: new customers
      ]) as unknown);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      // Should return all-time avg: Math.round(1500 / 5) = 300
      expect(result.revenueOverview.avgBookingValue).toBe(300);
    });

    it("should return 0 avg booking value when no bookings exist at all", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 0 }],
        [{ total: 0 }],
        [{ total: 0 }],
        [{ count: 0 }],             // booking count → triggers fallback
        [{ total: 0, count: 0 }],   // all-time fallback: also 0
        [{ count: 0 }],             // total customers
        [{ count: 0 }],             // new customers
      ]) as unknown);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.avgBookingValue).toBe(0);
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
      vi.mocked(db.select).mockReturnValue(mockBuilder as unknown);

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
      ]) as unknown);

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
      ]) as unknown);

      const request = new Request("http://test.com/tenant/reports");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.revenueOverview.changePercent).toBe(-20);
    });
  });
});
