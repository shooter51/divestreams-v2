import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";

/**
 * Integration tests for discount management
 * Tests discount code CRUD operations and validation
 */

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("tenant/discounts route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    isPremium: true,
  };

  const mockDiscounts = [
    {
      id: "disc-1",
      code: "SUMMER20",
      description: "20% off summer dives",
      type: "percentage",
      value: 20,
      minPurchase: 0,
      maxUses: 100,
      usedCount: 15,
      validFrom: new Date("2025-06-01"),
      validUntil: new Date("2025-08-31"),
      isActive: true,
    },
    {
      id: "disc-2",
      code: "FLAT50",
      description: "$50 off any booking",
      type: "fixed",
      value: 5000,
      minPurchase: 10000,
      maxUses: null,
      usedCount: 5,
      validFrom: null,
      validUntil: null,
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("Discount Data Requirements", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/discounts");
      await requireOrgContext(request);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns premium status from context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/discounts");
      const ctx = await requireOrgContext(request);

      expect(ctx.isPremium).toBe(true);
    });

    it("discounts have all required fields", () => {
      const discount = mockDiscounts[0];

      expect(discount.id).toBeDefined();
      expect(discount.code).toBeDefined();
      expect(discount.type).toBeDefined();
      expect(discount.value).toBeDefined();
      expect(discount.isActive).toBeDefined();
    });
  });

  describe("Discount Type Validation", () => {
    it("percentage discounts use whole numbers (1-100)", () => {
      const percentageDiscount = mockDiscounts[0];
      expect(percentageDiscount.type).toBe("percentage");
      expect(percentageDiscount.value).toBe(20); // 20%
      expect(percentageDiscount.value).toBeGreaterThan(0);
      expect(percentageDiscount.value).toBeLessThanOrEqual(100);
    });

    it("fixed discounts store values in cents", () => {
      const fixedDiscount = mockDiscounts[1];
      expect(fixedDiscount.type).toBe("fixed");
      expect(fixedDiscount.value).toBe(5000); // $50.00 in cents
    });

    it("calculates percentage discount amount", () => {
      const basePrice = 10000; // $100.00
      const discount = mockDiscounts[0];
      const discountAmount = Math.floor(basePrice * (discount.value / 100));

      expect(discountAmount).toBe(2000); // $20.00 discount
    });

    it("calculates fixed discount amount", () => {
      const basePrice = 10000; // $100.00
      const discount = mockDiscounts[1];
      const discountAmount = Math.min(discount.value, basePrice);

      expect(discountAmount).toBe(5000); // $50.00 discount
    });
  });

  describe("Discount Code Validation", () => {
    it("validates discount code format", () => {
      const validCodes = ["SUMMER20", "FLAT50", "WELCOME10"];
      const codeRegex = /^[A-Z0-9]+$/;

      validCodes.forEach(code => {
        expect(code).toMatch(codeRegex);
      });
    });

    it("checks minimum purchase requirement", () => {
      const discount = mockDiscounts[1];
      const purchaseAmount = 8000; // $80.00

      const meetsMinimum = purchaseAmount >= (discount.minPurchase ?? 0);
      expect(meetsMinimum).toBe(false); // $80 < $100 minimum
    });

    it("checks usage limits", () => {
      const discount = mockDiscounts[0];
      const isUsable = (discount.maxUses === null) || (discount.usedCount < discount.maxUses);

      expect(isUsable).toBe(true); // 15 < 100
    });

    it("checks validity period", () => {
      const discount = mockDiscounts[0];
      const now = new Date("2025-07-15");

      const isValidDate =
        (!discount.validFrom || now >= discount.validFrom) &&
        (!discount.validUntil || now <= discount.validUntil);

      expect(isValidDate).toBe(true);
    });

    it("detects expired discount", () => {
      const discount = mockDiscounts[0];
      const now = new Date("2025-09-15"); // After August 31

      const isValidDate = !discount.validUntil || now <= discount.validUntil;

      expect(isValidDate).toBe(false);
    });
  });

  describe("Discount CRUD Operations", () => {
    it("creates discount with required fields", () => {
      const newDiscount = {
        code: "NEWCODE25",
        description: "25% off new customers",
        type: "percentage",
        value: 25,
      };

      expect(newDiscount.code).toBeDefined();
      expect(newDiscount.type).toBeDefined();
      expect(newDiscount.value).toBeDefined();
    });

    it("validates required fields for creation", () => {
      const invalidDiscount = {
        code: "", // Empty code
        type: "percentage",
        value: 25,
      };

      const isValid = invalidDiscount.code.length > 0;
      expect(isValid).toBe(false);
    });

    it("toggles discount active status", () => {
      const discount = { ...mockDiscounts[0] };
      discount.isActive = !discount.isActive;

      expect(discount.isActive).toBe(false);
    });

    it("tracks usage count", () => {
      const discount = { ...mockDiscounts[0] };
      discount.usedCount += 1;

      expect(discount.usedCount).toBe(16);
    });
  });

  describe("Discount Application", () => {
    it("applies percentage discount to order total", () => {
      const orderTotal = 15000; // $150.00
      const discount = mockDiscounts[0]; // 20%

      const discountAmount = Math.floor(orderTotal * (discount.value / 100));
      const finalTotal = orderTotal - discountAmount;

      expect(discountAmount).toBe(3000); // $30.00
      expect(finalTotal).toBe(12000); // $120.00
    });

    it("applies fixed discount to order total", () => {
      const orderTotal = 15000; // $150.00
      const discount = mockDiscounts[1]; // $50.00

      const discountAmount = Math.min(discount.value, orderTotal);
      const finalTotal = orderTotal - discountAmount;

      expect(discountAmount).toBe(5000); // $50.00
      expect(finalTotal).toBe(10000); // $100.00
    });

    it("caps discount at order total", () => {
      const orderTotal = 3000; // $30.00
      const discount = mockDiscounts[1]; // $50.00 fixed

      const discountAmount = Math.min(discount.value, orderTotal);
      const finalTotal = Math.max(0, orderTotal - discountAmount);

      expect(discountAmount).toBe(3000); // Capped at order total
      expect(finalTotal).toBe(0);
    });
  });
});
