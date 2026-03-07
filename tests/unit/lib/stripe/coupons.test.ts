/**
 * Tests for Stripe Subscription Coupon Functions
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Use vi.hoisted so these are available inside the hoisted vi.mock factory
const {
  mockCouponsCreate,
  mockPromoCodesCreate,
  mockPromoCodesUpdate,
  mockSubscriptionsUpdate,
} = vi.hoisted(() => ({
  mockCouponsCreate: vi.fn(),
  mockPromoCodesCreate: vi.fn(),
  mockPromoCodesUpdate: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
}));

// Mock stripe module
vi.mock("../../../../lib/stripe/index", () => ({
  stripe: {
    coupons: { create: mockCouponsCreate },
    promotionCodes: { create: mockPromoCodesCreate, update: mockPromoCodesUpdate },
    subscriptions: { update: mockSubscriptionsUpdate },
  },
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock drizzle-orm to avoid real SQL building
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, type: "and" })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values, type: "sql" })),
    { raw: vi.fn((s: string) => s) }
  ),
}));

// Mock schema to avoid importing pg-core
vi.mock("../../../../lib/db/schema", () => ({
  subscriptionCoupons: {
    id: "id",
    code: "code",
    isActive: "is_active",
    redemptionCount: "redemption_count",
    createdAt: "created_at",
  },
  subscription: {
    organizationId: "organization_id",
    stripeSubscriptionId: "stripe_subscription_id",
  },
}));

import {
  createStripeCoupon,
  getSubscriptionCoupons,
  deactivateStripeCoupon,
  applySubscriptionCoupon,
} from "../../../../lib/stripe/coupons.server";

describe("Subscription Coupon Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createStripeCoupon", () => {
    it("creates a percentage coupon in Stripe and the database", async () => {
      const { db } = await import("../../../../lib/db");

      const mockDbCoupon = {
        id: "uuid-1",
        code: "SAVE10",
        stripeCouponId: "coupon_abc123",
        stripePromotionCodeId: "promo_xyz789",
        name: "10% Off",
        discountType: "percentage",
        discountValue: "10",
        duration: "once",
        isActive: true,
        redemptionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCouponsCreate.mockResolvedValue({ id: "coupon_abc123" });
      mockPromoCodesCreate.mockResolvedValue({ id: "promo_xyz789" });
      (db.insert as Mock).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDbCoupon]),
        }),
      });

      const result = await createStripeCoupon({
        code: "save10",
        name: "10% Off",
        discountType: "percentage",
        discountValue: 10,
        duration: "once",
      });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "10% Off",
          duration: "once",
          percent_off: 10,
        })
      );
      expect(mockPromoCodesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          promotion: { type: "coupon", coupon: "coupon_abc123" },
          code: "SAVE10",
        })
      );
      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockDbCoupon);
    });

    it("creates a fixed amount coupon in Stripe and the database", async () => {
      const { db } = await import("../../../../lib/db");

      const mockDbCoupon = {
        id: "uuid-2",
        code: "FLAT20",
        stripeCouponId: "coupon_fixed123",
        stripePromotionCodeId: "promo_fixed789",
        name: "$20 Off",
        discountType: "fixed",
        discountValue: "20",
        duration: "once",
        isActive: true,
        redemptionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCouponsCreate.mockResolvedValue({ id: "coupon_fixed123" });
      mockPromoCodesCreate.mockResolvedValue({ id: "promo_fixed789" });
      (db.insert as Mock).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDbCoupon]),
        }),
      });

      const result = await createStripeCoupon({
        code: "flat20",
        name: "$20 Off",
        discountType: "fixed",
        discountValue: 20,
        duration: "once",
      });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "$20 Off",
          amount_off: 2000, // 20 * 100 cents
          currency: "usd",
        })
      );
      expect(result).toEqual(mockDbCoupon);
    });

    it("sets duration_in_months for repeating coupons", async () => {
      const { db } = await import("../../../../lib/db");

      mockCouponsCreate.mockResolvedValue({ id: "coupon_rep" });
      mockPromoCodesCreate.mockResolvedValue({ id: "promo_rep" });
      (db.insert as Mock).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "uuid-3", code: "REP3MO" }]),
        }),
      });

      await createStripeCoupon({
        code: "rep3mo",
        name: "3 Month Discount",
        discountType: "percentage",
        discountValue: 15,
        duration: "repeating",
        durationInMonths: 3,
      });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: "repeating",
          duration_in_months: 3,
        })
      );
    });

    it("sets max_redemptions and redeem_by when provided", async () => {
      const { db } = await import("../../../../lib/db");

      const expiresAt = new Date("2027-01-01T00:00:00Z");

      mockCouponsCreate.mockResolvedValue({ id: "coupon_lim" });
      mockPromoCodesCreate.mockResolvedValue({ id: "promo_lim" });
      (db.insert as Mock).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "uuid-4", code: "LIMITED" }]),
        }),
      });

      await createStripeCoupon({
        code: "limited",
        name: "Limited Offer",
        discountType: "percentage",
        discountValue: 5,
        duration: "once",
        maxRedemptions: 50,
        expiresAt,
      });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_redemptions: 50,
          redeem_by: Math.floor(expiresAt.getTime() / 1000),
        })
      );
      expect(mockPromoCodesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_redemptions: 50,
          expires_at: Math.floor(expiresAt.getTime() / 1000),
        })
      );
    });
  });

  describe("getSubscriptionCoupons", () => {
    it("returns all coupons ordered by createdAt desc", async () => {
      const { db } = await import("../../../../lib/db");

      const mockCoupons = [
        { id: "uuid-1", code: "NEWER", createdAt: new Date("2026-02-01") },
        { id: "uuid-2", code: "OLDER", createdAt: new Date("2026-01-01") },
      ];

      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockCoupons),
        }),
      });

      const result = await getSubscriptionCoupons();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockCoupons);
    });
  });

  describe("deactivateStripeCoupon", () => {
    it("deactivates the promotion code in Stripe and sets isActive=false in DB", async () => {
      const { db } = await import("../../../../lib/db");

      const mockCoupon = {
        id: "uuid-1",
        stripeCouponId: "coupon_abc",
        stripePromotionCodeId: "promo_xyz",
        isActive: true,
      };
      const mockUpdated = { ...mockCoupon, isActive: false };

      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCoupon]),
        }),
      });

      mockPromoCodesUpdate.mockResolvedValue({ id: "promo_xyz", active: false });

      (db.update as Mock).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      const result = await deactivateStripeCoupon("uuid-1");

      expect(mockPromoCodesUpdate).toHaveBeenCalledWith("promo_xyz", { active: false });
      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual(mockUpdated);
    });

    it("throws when coupon is not found", async () => {
      const { db } = await import("../../../../lib/db");

      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(deactivateStripeCoupon("nonexistent-id")).rejects.toThrow("Coupon not found");
    });

    it("skips Stripe update if no stripePromotionCodeId", async () => {
      const { db } = await import("../../../../lib/db");

      const mockCoupon = {
        id: "uuid-1",
        stripeCouponId: "coupon_abc",
        stripePromotionCodeId: null,
        isActive: true,
      };

      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCoupon]),
        }),
      });

      (db.update as Mock).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockCoupon, isActive: false }]),
          }),
        }),
      });

      await deactivateStripeCoupon("uuid-1");

      expect(mockPromoCodesUpdate).not.toHaveBeenCalled();
    });
  });

  describe("applySubscriptionCoupon", () => {
    it("applies a valid coupon to the Stripe subscription and increments redemption count", async () => {
      const { db } = await import("../../../../lib/db");

      const mockCoupon = {
        id: "uuid-1",
        code: "SAVE10",
        stripeCouponId: "coupon_abc",
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
      };
      const mockSub = {
        organizationId: "org-1",
        stripeSubscriptionId: "sub_xyz",
      };

      // First select: look up coupon
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCoupon]),
        }),
      });

      // Second select: look up subscription
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSub]),
        }),
      });

      mockSubscriptionsUpdate.mockResolvedValue({});

      (db.update as Mock).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await applySubscriptionCoupon("org-1", "save10");

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_xyz", {
        discounts: [{ coupon: "coupon_abc" }],
      });
      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual(mockCoupon);
    });

    it("throws for invalid (not found) coupon code", async () => {
      const { db } = await import("../../../../lib/db");

      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(applySubscriptionCoupon("org-1", "BADCODE")).rejects.toThrow(
        "Invalid coupon code"
      );
    });

    it("throws when coupon is expired", async () => {
      const { db } = await import("../../../../lib/db");

      const expiredCoupon = {
        id: "uuid-1",
        code: "EXPIRED",
        isActive: true,
        expiresAt: new Date("2020-01-01"),
        maxRedemptions: null,
        redemptionCount: 0,
      };

      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([expiredCoupon]),
        }),
      });

      await expect(applySubscriptionCoupon("org-1", "EXPIRED")).rejects.toThrow(
        "This coupon has expired"
      );
    });

    it("throws when max redemptions reached", async () => {
      const { db } = await import("../../../../lib/db");

      const maxedCoupon = {
        id: "uuid-1",
        code: "MAXED",
        isActive: true,
        expiresAt: null,
        maxRedemptions: 10,
        redemptionCount: 10,
      };

      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([maxedCoupon]),
        }),
      });

      await expect(applySubscriptionCoupon("org-1", "MAXED")).rejects.toThrow(
        "This coupon has reached its maximum redemptions"
      );
    });

    it("throws when no active Stripe subscription is found for the org", async () => {
      const { db } = await import("../../../../lib/db");

      const validCoupon = {
        id: "uuid-1",
        code: "VALID",
        stripeCouponId: "coupon_abc",
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
      };

      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([validCoupon]),
        }),
      });

      // No subscription found
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(applySubscriptionCoupon("org-1", "VALID")).rejects.toThrow(
        "No active Stripe subscription found"
      );
    });
  });
});
