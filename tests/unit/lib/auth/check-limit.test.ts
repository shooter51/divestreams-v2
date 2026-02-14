/**
 * Check Limit Tests
 *
 * Tests for the checkLimit function in org-context.server.
 * FREE_TIER_LIMITS and PREMIUM_LIMITS are now derived from DEFAULT_PLAN_LIMITS
 * in plan-features.ts (the single source of truth for plan configuration).
 */

import { describe, it, expect } from "vitest";
import {
  checkLimit,
  FREE_TIER_LIMITS,
  PREMIUM_LIMITS,
  type OrgContext,
} from "../../../../lib/auth/org-context.server";

describe("checkLimit", () => {
  // Helper to create mock context
  function createMockContext(overrides: Partial<OrgContext> = {}): OrgContext {
    return {
      user: { id: "user-1", name: "Test", email: "test@example.com" } as any,
      session: { id: "session-1" } as any,
      org: { id: "org-1", name: "Test Org", slug: "test" } as any,
      membership: { role: "owner" } as any,
      subscription: null,
      limits: FREE_TIER_LIMITS,
      usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
      canAddCustomer: true,
      canAddTour: true,
      canAddBooking: true,
      isPremium: false,
      ...overrides,
    };
  }

  describe("customer limit", () => {
    it("returns allowed=true when under customer limit", () => {
      const context = createMockContext({
        canAddCustomer: true,
        usage: { customers: 10, tours: 0, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "customer");

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("returns allowed=false when at customer limit", () => {
      const context = createMockContext({
        canAddCustomer: false,
        limits: FREE_TIER_LIMITS,
        usage: { customers: FREE_TIER_LIMITS.customers, tours: 0, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "customer");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Customer limit reached");
      expect(result.message).toContain(FREE_TIER_LIMITS.customers.toString());
    });

    it("returns allowed=true for premium users at limit", () => {
      const context = createMockContext({
        canAddCustomer: true,
        isPremium: true,
        limits: PREMIUM_LIMITS,
        usage: { customers: 1000, tours: 0, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "customer");

      expect(result.allowed).toBe(true);
    });
  });

  describe("tour limit", () => {
    it("returns allowed=true when under tour limit", () => {
      const context = createMockContext({
        canAddTour: true,
        usage: { customers: 0, tours: 1, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "tour");

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("returns allowed=false when at tour limit", () => {
      const context = createMockContext({
        canAddTour: false,
        limits: FREE_TIER_LIMITS,
        usage: { customers: 0, tours: FREE_TIER_LIMITS.tours, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "tour");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Tour limit reached");
      expect(result.message).toContain(FREE_TIER_LIMITS.tours.toString());
    });

    it("returns allowed=true for premium users at limit", () => {
      const context = createMockContext({
        canAddTour: true,
        isPremium: true,
        limits: PREMIUM_LIMITS,
        usage: { customers: 0, tours: 100, bookingsThisMonth: 0 },
      });

      const result = checkLimit(context, "tour");

      expect(result.allowed).toBe(true);
    });
  });

  describe("booking limit", () => {
    it("returns allowed=true when under booking limit", () => {
      const context = createMockContext({
        canAddBooking: true,
        usage: { customers: 0, tours: 0, bookingsThisMonth: 2 },
      });

      const result = checkLimit(context, "booking");

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("returns allowed=false when at booking limit", () => {
      const context = createMockContext({
        canAddBooking: false,
        limits: FREE_TIER_LIMITS,
        usage: { customers: 0, tours: 0, bookingsThisMonth: FREE_TIER_LIMITS.bookingsPerMonth },
      });

      const result = checkLimit(context, "booking");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Monthly booking limit reached");
      expect(result.message).toContain(FREE_TIER_LIMITS.bookingsPerMonth.toString());
    });

    it("returns allowed=true for premium users at limit", () => {
      const context = createMockContext({
        canAddBooking: true,
        isPremium: true,
        limits: PREMIUM_LIMITS,
        usage: { customers: 0, tours: 0, bookingsThisMonth: 500 },
      });

      const result = checkLimit(context, "booking");

      expect(result.allowed).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles zero usage", () => {
      const context = createMockContext({
        canAddCustomer: true,
        canAddTour: true,
        canAddBooking: true,
        usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
      });

      expect(checkLimit(context, "customer").allowed).toBe(true);
      expect(checkLimit(context, "tour").allowed).toBe(true);
      expect(checkLimit(context, "booking").allowed).toBe(true);
    });

    it("messages include upgrade CTA", () => {
      const context = createMockContext({ canAddCustomer: false });
      const result = checkLimit(context, "customer");

      expect(result.message).toContain("Upgrade to premium");
    });
  });
});
