/**
 * Marketing Pricing Route Tests
 *
 * Tests the pricing marketing page with database plan fetching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/marketing/pricing";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked db
import { db } from "../../../../lib/db";

describe("Route: marketing/pricing.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "Pricing - DiveStreams" },
        { name: "description", content: "Simple, transparent pricing for dive shops of all sizes." },
      ]);
    });
  });

  describe("loader", () => {
    const mockPlans = [
      {
        id: "plan-1",
        name: "pro",
        displayName: "Pro",
        monthlyPrice: 9900,
        yearlyPrice: 95000,
        features: ["Up to 10 users", "Unlimited customers", "Online booking widget"],
        isActive: true,
      },
      {
        id: "plan-2",
        name: "starter",
        displayName: "Starter",
        monthlyPrice: 4900,
        yearlyPrice: 47000,
        features: ["Up to 3 users", "1,000 customers", "Booking management"],
        isActive: true,
      },
      {
        id: "plan-3",
        name: "enterprise",
        displayName: "Enterprise",
        monthlyPrice: 19900,
        yearlyPrice: 191000,
        features: ["Unlimited users", "Multi-location support", "Custom integrations"],
        isActive: true,
      },
    ];

    it("should fetch active subscription plans from database and sort by price", async () => {
      // Arrange
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(mockPlans);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await loader({ request: new Request("http://test.com"), params: {}, context: {} });

      // Assert
      expect(db.select).toHaveBeenCalled();
      expect(result.plans).toHaveLength(3);
      // Verify sorted by monthlyPrice ascending
      expect(result.plans[0].name).toBe("starter"); // 4900
      expect(result.plans[1].name).toBe("pro"); // 9900
      expect(result.plans[2].name).toBe("enterprise"); // 19900
    });

    it("should return DEFAULT_PLANS when no plans in database", async () => {
      // Arrange
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await loader({ request: new Request("http://test.com"), params: {}, context: {} });

      // Assert
      expect(result.plans).toHaveLength(3);
      expect(result.plans[0].name).toBe("starter");
      expect(result.plans[0].id).toBe("default-starter");
      expect(result.plans[1].name).toBe("pro");
      expect(result.plans[1].id).toBe("default-pro");
      expect(result.plans[2].name).toBe("enterprise");
      expect(result.plans[2].id).toBe("default-enterprise");
    });

    it("should return DEFAULT_PLANS when database query fails", async () => {
      // Arrange
      (db.select as any).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      // Act
      const result = await loader({ request: new Request("http://test.com"), params: {}, context: {} });

      // Assert
      expect(console.error).toHaveBeenCalledWith(
        "Failed to fetch subscription plans from database:",
        expect.any(Error)
      );
      expect(result.plans).toHaveLength(3);
      expect(result.plans[0].id).toBe("default-starter");
      expect(result.plans[1].id).toBe("default-pro");
      expect(result.plans[2].id).toBe("default-enterprise");
    });
  });
});
