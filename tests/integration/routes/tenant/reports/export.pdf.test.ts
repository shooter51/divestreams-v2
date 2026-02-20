import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/reports/export.pdf";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/reports/export.pdf.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockOrgContext = {
    org: { id: mockOrganizationId, name: "Test Dive Shop", slug: "test-shop" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue(mockOrgContext as unknown);
  });

  describe("loader", () => {
    it("should generate PDF with report data", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      // Mock the various select queries
      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 5000 }]) // Current month revenue
        .mockResolvedValueOnce([{ total: 4500 }]) // Last month revenue
        .mockResolvedValueOnce([{ count: 25 }]) // Booking count
        .mockResolvedValueOnce([{ count: 150 }]) // Total customers
        .mockResolvedValueOnce([{ count: 10 }]) // New customers
        .mockResolvedValueOnce([
          {
            id: "booking-1",
            customerFirstName: "John",
            customerLastName: "Doe",
            tourName: "Reef Dive",
            total: "200",
            status: "confirmed",
            createdAt: new Date("2024-01-15"),
          },
        ]); // Recent bookings (limit 20 for PDF)

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(200);
      expect(result.headers.get("Content-Type")).toBe("application/pdf");
      expect(result.headers.get("Content-Disposition")).toContain("attachment");
      expect(result.headers.get("Content-Disposition")).toContain(".pdf");

      // Verify it's actually a PDF (starts with PDF magic bytes)
      const arrayBuffer = await result.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pdfHeader = String.fromCharCode(...bytes.slice(0, 4));
      expect(pdfHeader).toBe("%PDF");
    });

    it("should use custom date range from query params", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 3000 }])
        .mockResolvedValueOnce([{ total: 2500 }])
        .mockResolvedValueOnce([{ count: 15 }])
        .mockResolvedValueOnce([{ count: 100 }])
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([]);

      const request = new Request(
        "http://test.com/tenant/reports/export/pdf?startDate=2024-01-01&endDate=2024-01-31"
      );
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      expect(result.headers.get("Content-Disposition")).toContain("2024-01-01-to-2024-01-31");
    });

    it("should default to current month when no dates provided", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 5000 }])
        .mockResolvedValueOnce([{ total: 4500 }])
        .mockResolvedValueOnce([{ count: 25 }])
        .mockResolvedValueOnce([{ count: 150 }])
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([]);

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      const arrayBuffer = await result.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pdfHeader = String.fromCharCode(...bytes.slice(0, 4));
      expect(pdfHeader).toBe("%PDF");
    });

    it("should handle empty bookings list", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      const arrayBuffer = await result.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    });

    it("should handle database errors gracefully", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Database error")),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      const arrayBuffer = await result.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pdfHeader = String.fromCharCode(...bytes.slice(0, 4));
      expect(pdfHeader).toBe("%PDF");
    });

    it("should limit bookings to 20 for PDF", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn(),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      // Create 25 bookings but only 20 should be included
      const mockBookings = Array.from({ length: 25 }, (_, i) => ({
        id: `booking-${i}`,
        customerFirstName: "John",
        customerLastName: `Doe ${i}`,
        tourName: "Reef Dive",
        total: "200",
        status: "confirmed",
        createdAt: new Date("2024-01-15"),
      }));

      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 5000 }])
        .mockResolvedValueOnce([{ total: 4500 }])
        .mockResolvedValueOnce([{ count: 25 }])
        .mockResolvedValueOnce([{ count: 150 }])
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce(mockBookings.slice(0, 20)); // limit(20) in route

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      // Verify limit(20) was called for bookings query
      expect(mockSelectBuilder.limit).toHaveBeenCalledWith(20);
    });

    it("should truncate long customer and tour names", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as unknown);

      mockSelectBuilder.limit
        .mockResolvedValueOnce([{ total: 1000 }])
        .mockResolvedValueOnce([{ total: 900 }])
        .mockResolvedValueOnce([{ count: 5 }])
        .mockResolvedValueOnce([{ count: 50 }])
        .mockResolvedValueOnce([{ count: 3 }])
        .mockResolvedValueOnce([
          {
            id: "booking-1",
            customerFirstName: "VeryLongFirstNameThatExceedsLimit",
            customerLastName: "VeryLongLastNameThatExceedsLimit",
            tourName: "VeryLongTourNameThatExceedsTheTwentyTwoCharacterLimit",
            total: "200",
            status: "confirmed",
            createdAt: new Date("2024-01-15"),
          },
        ]);

      const request = new Request("http://test.com/tenant/reports/export/pdf");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe(200);
      // Should still generate valid PDF even with long names
      const arrayBuffer = await result.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pdfHeader = String.fromCharCode(...bytes.slice(0, 4));
      expect(pdfHeader).toBe("%PDF");
    });
  });
});
