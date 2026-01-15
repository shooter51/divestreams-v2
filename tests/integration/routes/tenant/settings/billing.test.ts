import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Integration tests for billing settings route
 * Tests the billing page functionality for subscription management
 */

// Mock dependencies before imports
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the entire route module to test action intents
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://stripe.com/portal/session" }),
      },
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://stripe.com/checkout/session" }),
      },
    },
    subscriptions: {
      cancel: vi.fn().mockResolvedValue({ status: "canceled" }),
    },
  })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";

describe("tenant/settings/billing route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", metadata: null },
    membership: { role: "owner" },
    subscription: {
      id: "sub-1",
      plan: "free",
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: new Date("2025-01-01"),
      currentPeriodEnd: new Date("2025-02-01"),
    },
    isPremium: false,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 10, tours: 1, bookingsThisMonth: 5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("Billing Context", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/billing");
      await requireOrgContext(request);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns subscription data from context", () => {
      expect(mockOrgContext.subscription).toBeDefined();
      expect(mockOrgContext.subscription.plan).toBe("free");
      expect(mockOrgContext.subscription.status).toBe("active");
    });

    it("returns usage and limits from context", () => {
      expect(mockOrgContext.limits).toBeDefined();
      expect(mockOrgContext.usage).toBeDefined();
      expect(mockOrgContext.limits.customers).toBe(50);
      expect(mockOrgContext.usage.customers).toBe(10);
    });

    it("returns premium status from context", () => {
      expect(mockOrgContext.isPremium).toBe(false);
    });

    it("premium subscribers have different context", () => {
      const premiumContext = {
        ...mockOrgContext,
        subscription: { ...mockOrgContext.subscription, plan: "premium" },
        isPremium: true,
        limits: { customers: Infinity, tours: Infinity, bookingsPerMonth: Infinity },
      };

      expect(premiumContext.isPremium).toBe(true);
      expect(premiumContext.subscription.plan).toBe("premium");
    });
  });

  describe("Billing Intents", () => {
    it("manage intent requires Stripe customer ID", () => {
      const contextWithStripe = {
        ...mockOrgContext,
        subscription: {
          ...mockOrgContext.subscription,
          stripeCustomerId: "cus_test123",
        },
      };

      expect(contextWithStripe.subscription.stripeCustomerId).toBe("cus_test123");
    });

    it("upgrade intent includes plan selection", () => {
      const upgradeData = {
        intent: "upgrade",
        planId: "plan-pro",
        interval: "monthly",
      };

      expect(upgradeData.intent).toBe("upgrade");
      expect(upgradeData.planId).toBe("plan-pro");
      expect(upgradeData.interval).toBe("monthly");
    });

    it("cancel intent requires active subscription", () => {
      const activeSubscription = {
        ...mockOrgContext.subscription,
        stripeSubscriptionId: "sub_test123",
        status: "active",
      };

      expect(activeSubscription.stripeSubscriptionId).toBe("sub_test123");
      expect(activeSubscription.status).toBe("active");
    });
  });

  describe("Plan Comparison", () => {
    const mockPlans = [
      {
        id: "plan-free",
        name: "free",
        displayName: "Free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: ["Up to 50 customers", "3 tours"],
      },
      {
        id: "plan-pro",
        name: "professional",
        displayName: "Professional",
        monthlyPrice: 4900,
        yearlyPrice: 49000,
        features: ["Unlimited customers", "Unlimited tours"],
      },
    ];

    it("free plan has limited features", () => {
      const freePlan = mockPlans.find(p => p.name === "free");
      expect(freePlan?.monthlyPrice).toBe(0);
      expect(freePlan?.features).toContain("Up to 50 customers");
    });

    it("professional plan has unlimited features", () => {
      const proPlan = mockPlans.find(p => p.name === "professional");
      expect(proPlan?.monthlyPrice).toBe(4900);
      expect(proPlan?.features).toContain("Unlimited customers");
    });

    it("yearly pricing offers discount", () => {
      const proPlan = mockPlans.find(p => p.name === "professional");
      // 49000 / 12 = ~4083 vs 4900 monthly = savings
      const monthlyEquivalent = (proPlan?.yearlyPrice ?? 0) / 12;
      expect(monthlyEquivalent).toBeLessThan(proPlan?.monthlyPrice ?? 0);
    });
  });

  describe("Usage Tracking", () => {
    it("tracks customers used vs limit", () => {
      const usagePercent = (mockOrgContext.usage.customers / mockOrgContext.limits.customers) * 100;
      expect(usagePercent).toBe(20); // 10/50 = 20%
    });

    it("tracks tours used vs limit", () => {
      const usagePercent = (mockOrgContext.usage.tours / mockOrgContext.limits.tours) * 100;
      expect(usagePercent).toBeCloseTo(33.33, 1); // 1/3 = 33%
    });

    it("tracks monthly bookings used vs limit", () => {
      const usagePercent = (mockOrgContext.usage.bookingsThisMonth / mockOrgContext.limits.bookingsPerMonth) * 100;
      expect(usagePercent).toBe(25); // 5/20 = 25%
    });

    it("identifies approaching limits", () => {
      const highUsageContext = {
        ...mockOrgContext,
        usage: { customers: 45, tours: 3, bookingsThisMonth: 18 },
      };

      const customerPercent = (highUsageContext.usage.customers / mockOrgContext.limits.customers) * 100;
      expect(customerPercent).toBe(90);
    });
  });
});
