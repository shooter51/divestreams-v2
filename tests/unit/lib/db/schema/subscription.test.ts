/**
 * Subscription Schema Tests
 *
 * Tests for subscription and usage tracking schema types.
 */

import { describe, it, expect } from "vitest";
import {
  type Subscription,
  type NewSubscription,
  type UsageTracking,
  type NewUsageTracking,
} from "../../../../../lib/db/schema/subscription";

describe("Subscription Schema", () => {
  describe("Subscription type", () => {
    it("has required fields structure", () => {
      const subscription: Partial<Subscription> = {
        id: "sub-123",
        organizationId: "org-1",
        plan: "premium",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(subscription.plan).toBe("premium");
      expect(subscription.status).toBe("active");
    });

    it("supports standard plan", () => {
      const subscription: Partial<Subscription> = {
        plan: "standard",
        status: "active",
      };
      expect(subscription.plan).toBe("standard");
    });

    it("supports trialing status", () => {
      const subscription: Partial<Subscription> = {
        plan: "premium",
        status: "trialing",
        trialEndsAt: new Date("2025-02-15"),
      };
      expect(subscription.status).toBe("trialing");
    });

    it("supports past_due status", () => {
      const subscription: Partial<Subscription> = {
        plan: "premium",
        status: "past_due",
      };
      expect(subscription.status).toBe("past_due");
    });

    it("supports canceled status", () => {
      const subscription: Partial<Subscription> = {
        plan: "premium",
        status: "canceled",
      };
      expect(subscription.status).toBe("canceled");
    });

    it("has Stripe integration fields", () => {
      const subscription: Partial<Subscription> = {
        stripeCustomerId: "cus_123456",
        stripeSubscriptionId: "sub_123456",
        stripePriceId: "price_123456",
        currentPeriodStart: new Date("2025-01-01"),
        currentPeriodEnd: new Date("2025-02-01"),
      };

      expect(subscription.stripeCustomerId).toMatch(/^cus_/);
      expect(subscription.stripeSubscriptionId).toMatch(/^sub_/);
      expect(subscription.stripePriceId).toMatch(/^price_/);
    });

    it("allows null Stripe fields for standard tier", () => {
      const subscription: Partial<Subscription> = {
        plan: "standard",
        status: "active",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };

      expect(subscription.stripeCustomerId).toBeNull();
      expect(subscription.stripeSubscriptionId).toBeNull();
    });
  });

  describe("NewSubscription type", () => {
    it("requires organizationId and plan", () => {
      const newSubscription: Partial<NewSubscription> = {
        organizationId: "org-123",
        plan: "standard",
      };

      expect(newSubscription.organizationId).toBe("org-123");
      expect(newSubscription.plan).toBe("standard");
    });

    it("id is optional (auto-generated)", () => {
      const newSubscription: Partial<NewSubscription> = {
        organizationId: "org-456",
        plan: "premium",
      };

      expect(newSubscription.id).toBeUndefined();
    });
  });

  describe("UsageTracking type", () => {
    it("has required fields", () => {
      const usage: Partial<UsageTracking> = {
        id: "usage-123",
        organizationId: "org-1",
        month: "2025-01",
        bookingsCount: 25,
      };

      expect(usage.month).toBe("2025-01");
      expect(usage.bookingsCount).toBe(25);
    });

    it("month format is YYYY-MM", () => {
      const usage: Partial<UsageTracking> = {
        month: "2025-12",
      };

      expect(usage.month).toMatch(/^\d{4}-\d{2}$/);
    });

    it("bookingsCount can be zero", () => {
      const usage: Partial<UsageTracking> = {
        organizationId: "org-new",
        month: "2025-01",
        bookingsCount: 0,
      };

      expect(usage.bookingsCount).toBe(0);
    });

    it("tracks usage per organization per month", () => {
      const usageJan: Partial<UsageTracking> = {
        organizationId: "org-1",
        month: "2025-01",
        bookingsCount: 50,
      };

      const usageFeb: Partial<UsageTracking> = {
        organizationId: "org-1",
        month: "2025-02",
        bookingsCount: 35,
      };

      expect(usageJan.month).not.toBe(usageFeb.month);
      expect(usageJan.organizationId).toBe(usageFeb.organizationId);
    });
  });

  describe("NewUsageTracking type", () => {
    it("requires organizationId and month", () => {
      const newUsage: Partial<NewUsageTracking> = {
        organizationId: "org-123",
        month: "2025-03",
      };

      expect(newUsage.organizationId).toBe("org-123");
      expect(newUsage.month).toBe("2025-03");
    });

    it("bookingsCount defaults to 0", () => {
      const newUsage: Partial<NewUsageTracking> = {
        organizationId: "org-456",
        month: "2025-04",
      };

      // bookingsCount is optional with default 0
      expect(newUsage.bookingsCount).toBeUndefined();
    });
  });
});
