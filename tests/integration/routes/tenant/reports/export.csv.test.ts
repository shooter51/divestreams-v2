import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader } from "../../../../../app/routes/tenant/reports/export.csv";
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
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => {
      const result = results[callCount++];
      return Promise.resolve(result).then(resolve);
    }),
  };
}

describe("app/routes/tenant/reports/export.csv.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockOrgContext = {
    org: { id: mockOrganizationId, name: "Test Dive Shop", slug: "test-shop" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue(mockOrgContext as any);
  });

  describe("loader", () => {
    it("should generate CSV with report data", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }], // Current month revenue
        [{ total: 4500 }], // Last month revenue
        [{ count: 25 }], // Booking count
        [{ count: 150 }], // Total customers
        [{ count: 10 }], // New customers
        [
          {
            id: "booking-1",
            customerFirstName: "John",
            customerLastName: "Doe",
            tourName: "Reef Dive",
            total: "200",
            status: "confirmed",
            createdAt: new Date("2024-01-15"),
          },
        ], // Recent bookings
      ]) as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(200);
      expect(result.headers.get("Content-Type")).toBe("text/csv");
      expect(result.headers.get("Content-Disposition")).toContain("attachment");
      expect(result.headers.get("Content-Disposition")).toContain(".csv");

      const csvContent = await result.text();
      expect(csvContent).toContain("DiveStreams Reports Export");
      expect(csvContent).toContain("Test Dive Shop");
      expect(csvContent).toContain("REVENUE OVERVIEW");
      expect(csvContent).toContain("CUSTOMER STATISTICS");
      expect(csvContent).toContain("BOOKING DATA");
      expect(csvContent).toContain("John Doe");
      expect(csvContent).toContain("Reef Dive");
    });

    it("should use custom date range from query params", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 3000 }],
        [{ total: 2500 }],
        [{ count: 15 }],
        [{ count: 100 }],
        [{ count: 5 }],
        [],
      ]) as any);

      const request = new Request(
        "http://test.com/tenant/reports/export/csv?startDate=2024-01-01&endDate=2024-01-31"
      );
      const result = await loader({ request, params: {}, context: {} });

      expect(result.headers.get("Content-Disposition")).toContain("2024-01-01-to-2024-01-31");
      const csvContent = await result.text();
      // Route uses toLocaleDateString() which produces locale-specific format
      expect(csvContent).toContain("Date Range,");
    });

    it("should default to current month when no dates provided", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 5000 }],
        [{ total: 4500 }],
        [{ count: 25 }],
        [{ count: 150 }],
        [{ count: 10 }],
        [],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      const csvContent = await result.text();
      expect(csvContent).toContain("DiveStreams Reports Export");
    });

    it("should handle empty bookings list", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 0 }],
        [{ total: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      const csvContent = await result.text();
      expect(csvContent).toContain("BOOKING DATA");
      expect(csvContent).toContain("Booking ID,Customer Name,Tour Name");
    });

    it("should handle database errors gracefully", async () => {
      const mockBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn((resolve, reject) => {
          reject(new Error("Database error"));
          return Promise.reject(new Error("Database error"));
        }),
      };
      vi.mocked(db.select).mockReturnValue(mockBuilder as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      const csvContent = await result.text();
      expect(csvContent).toContain("DiveStreams Reports Export");
      expect(csvContent).toContain("$0"); // Default values
    });

    it("should sanitize commas in customer and tour names", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 1000 }],
        [{ total: 900 }],
        [{ count: 5 }],
        [{ count: 50 }],
        [{ count: 3 }],
        [
          {
            id: "booking-1",
            customerFirstName: "John",
            customerLastName: "Doe, Jr.",
            tourName: "Reef Dive, Advanced",
            total: "200",
            status: "confirmed",
            createdAt: new Date("2024-01-15"),
          },
        ],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      const csvContent = await result.text();
      // Commas should be replaced with semicolons
      expect(csvContent).toContain("John Doe; Jr.");
      expect(csvContent).toContain("Reef Dive; Advanced");
    });

    it("should include change percentage in CSV", async () => {
      vi.mocked(db.select).mockReturnValue(createMockBuilder([
        [{ total: 6000 }], // Current
        [{ total: 5000 }], // Last (20% increase)
        [{ count: 30 }],
        [{ count: 120 }],
        [{ count: 15 }],
        [],
      ]) as any);

      const request = new Request("http://test.com/tenant/reports/export/csv");
      const result = await loader({ request, params: {}, context: {} });

      const csvContent = await result.text();
      expect(csvContent).toContain("Change vs Last Month,+20%");
    });
  });
});
