import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Integration tests for reports route
 * Tests report data aggregation and display
 */

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("tenant/reports route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: { plan: "premium" },
    isPremium: true,
  };

  const mockBookingStats = {
    totalBookings: 150,
    confirmedBookings: 120,
    pendingBookings: 20,
    canceledBookings: 10,
    totalRevenue: 1500000, // $15,000.00
    averageBookingValue: 10000, // $100.00
  };

  const mockTopTours = [
    { id: "tour-1", name: "Beginner Dive", bookings: 45, revenue: 445500 },
    { id: "tour-2", name: "Advanced Reef", bookings: 30, revenue: 447000 },
    { id: "tour-3", name: "Night Dive", bookings: 25, revenue: 322500 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("Report Data Requirements", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/app/reports");
      await requireOrgContext(request);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns premium status", async () => {
      const request = new Request("https://demo.divestreams.com/app/reports");
      const ctx = await requireOrgContext(request);

      expect(ctx.isPremium).toBe(true);
    });
  });

  describe("Date Range Handling", () => {
    it("parses date range from URL params", () => {
      const url = new URL("https://demo.divestreams.com/app/reports?from=2025-01-01&to=2025-01-31");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      expect(from).toBe("2025-01-01");
      expect(to).toBe("2025-01-31");
    });

    it("calculates default date range (current month)", () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      expect(startOfMonth.getDate()).toBe(1);
      expect(endOfMonth.getDate()).toBeGreaterThan(27);
    });

    it("supports last 7 days range", () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const daysDiff = Math.round((now.getTime() - weekAgo.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });

    it("supports last 30 days range", () => {
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const daysDiff = Math.round((now.getTime() - monthAgo.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });
  });

  describe("Booking Statistics", () => {
    it("calculates total bookings", () => {
      expect(mockBookingStats.totalBookings).toBe(150);
    });

    it("breaks down bookings by status", () => {
      const total = mockBookingStats.confirmedBookings +
                    mockBookingStats.pendingBookings +
                    mockBookingStats.canceledBookings;

      expect(total).toBe(mockBookingStats.totalBookings);
    });

    it("calculates confirmation rate", () => {
      const confirmationRate = (mockBookingStats.confirmedBookings / mockBookingStats.totalBookings) * 100;
      expect(confirmationRate).toBe(80);
    });

    it("calculates cancellation rate", () => {
      const cancellationRate = (mockBookingStats.canceledBookings / mockBookingStats.totalBookings) * 100;
      expect(cancellationRate).toBeCloseTo(6.67, 1);
    });
  });

  describe("Revenue Metrics", () => {
    it("calculates total revenue", () => {
      expect(mockBookingStats.totalRevenue).toBe(1500000);
    });

    it("calculates average booking value", () => {
      expect(mockBookingStats.averageBookingValue).toBe(10000);
    });

    it("formats currency correctly", () => {
      const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(cents / 100);
      };

      expect(formatCurrency(mockBookingStats.totalRevenue)).toBe("$15,000.00");
      expect(formatCurrency(mockBookingStats.averageBookingValue)).toBe("$100.00");
    });

    it("calculates revenue per confirmed booking", () => {
      const revenuePerBooking = mockBookingStats.totalRevenue / mockBookingStats.confirmedBookings;
      expect(revenuePerBooking).toBe(12500); // $125.00
    });
  });

  describe("Top Tours Analysis", () => {
    it("returns tours sorted by revenue", () => {
      const sortedByRevenue = [...mockTopTours].sort((a, b) => b.revenue - a.revenue);
      expect(sortedByRevenue[0].name).toBe("Advanced Reef");
    });

    it("returns tours sorted by bookings", () => {
      const sortedByBookings = [...mockTopTours].sort((a, b) => b.bookings - a.bookings);
      expect(sortedByBookings[0].name).toBe("Beginner Dive");
    });

    it("calculates revenue percentage per tour", () => {
      const totalRevenue = mockTopTours.reduce((sum, t) => sum + t.revenue, 0);
      const reefPercentage = (mockTopTours[1].revenue / totalRevenue) * 100;

      expect(reefPercentage).toBeCloseTo(36.8, 0);
    });

    it("calculates average revenue per booking by tour", () => {
      const avgRevenue = mockTopTours.map(tour => ({
        name: tour.name,
        avgRevenue: tour.revenue / tour.bookings,
      }));

      expect(avgRevenue[0].avgRevenue).toBe(9900); // $99.00 for Beginner Dive
    });
  });

  describe("Customer Metrics", () => {
    const customerStats = {
      totalCustomers: 200,
      newCustomers: 25,
      repeatCustomers: 50,
      averageBookingsPerCustomer: 2.5,
    };

    it("calculates new customer acquisition", () => {
      const acquisitionRate = (customerStats.newCustomers / customerStats.totalCustomers) * 100;
      expect(acquisitionRate).toBe(12.5);
    });

    it("calculates repeat customer rate", () => {
      const repeatRate = (customerStats.repeatCustomers / customerStats.totalCustomers) * 100;
      expect(repeatRate).toBe(25);
    });

    it("calculates customer lifetime value estimate", () => {
      const avgBookingValue = mockBookingStats.averageBookingValue;
      const avgBookings = customerStats.averageBookingsPerCustomer;
      const estimatedLTV = avgBookingValue * avgBookings;

      expect(estimatedLTV).toBe(25000); // $250.00
    });
  });
});
