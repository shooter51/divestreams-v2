import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSubdomainFromRequest,
  FREE_TIER_LIMITS,
  PREMIUM_LIMITS,
  checkLimit,
  type OrgContext,
} from "../../../../lib/auth/org-context.server";
import { DEFAULT_PLAN_LIMITS } from "../../../../lib/plan-features";

describe("org-context.server - tenant context helpers", () => {
  describe("getSubdomainFromRequest", () => {
    it("extracts subdomain from localhost URL", () => {
      const request = new Request("http://demo.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });

    it("extracts subdomain from production URL", () => {
      const request = new Request("https://testshop.divestreams.com/app");
      expect(getSubdomainFromRequest(request)).toBe("testshop");
    });

    it("returns null for plain localhost", () => {
      const request = new Request("http://localhost:5173");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for main domain without subdomain", () => {
      const request = new Request("https://divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for www subdomain", () => {
      const request = new Request("https://www.divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("handles admin subdomain", () => {
      const request = new Request("http://admin.localhost:5173/dashboard");
      expect(getSubdomainFromRequest(request)).toBe("admin");
    });

    it("handles subdomains with hyphens", () => {
      const request = new Request("http://my-dive-shop.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("my-dive-shop");
    });

    it("handles subdomains with numbers", () => {
      const request = new Request("http://shop123.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("shop123");
    });
  });

  describe("FREE_TIER_LIMITS (derived from DEFAULT_PLAN_LIMITS.free)", () => {
    it("has limits matching DEFAULT_PLAN_LIMITS.free", () => {
      expect(FREE_TIER_LIMITS.customers).toBe(DEFAULT_PLAN_LIMITS.free.customers);
      expect(FREE_TIER_LIMITS.bookingsPerMonth).toBe(DEFAULT_PLAN_LIMITS.free.toursPerMonth);
      expect(FREE_TIER_LIMITS.tours).toBe(DEFAULT_PLAN_LIMITS.free.toursPerMonth);
      expect(FREE_TIER_LIMITS.teamMembers).toBe(DEFAULT_PLAN_LIMITS.free.users);
      expect(FREE_TIER_LIMITS.hasPOS).toBe(false);
      expect(FREE_TIER_LIMITS.hasEquipmentRentals).toBe(false);
      expect(FREE_TIER_LIMITS.hasAdvancedReports).toBe(false);
      expect(FREE_TIER_LIMITS.hasEmailNotifications).toBe(false);
    });
  });

  describe("PREMIUM_LIMITS (derived from DEFAULT_PLAN_LIMITS.enterprise)", () => {
    it("has unlimited premium tier limits", () => {
      expect(PREMIUM_LIMITS.customers).toBe(Infinity);
      expect(PREMIUM_LIMITS.bookingsPerMonth).toBe(Infinity);
      expect(PREMIUM_LIMITS.tours).toBe(Infinity);
      expect(PREMIUM_LIMITS.teamMembers).toBe(Infinity);
      expect(PREMIUM_LIMITS.hasPOS).toBe(true);
      expect(PREMIUM_LIMITS.hasEquipmentRentals).toBe(true);
      expect(PREMIUM_LIMITS.hasAdvancedReports).toBe(true);
      expect(PREMIUM_LIMITS.hasEmailNotifications).toBe(true);
    });
  });

  describe("checkLimit", () => {
    // Create mock context for testing
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

    it("allows adding customer when under limit", () => {
      const context = createMockContext({ canAddCustomer: true });
      const result = checkLimit(context, "customer");
      expect(result.allowed).toBe(true);
    });

    it("blocks adding customer when at limit", () => {
      const context = createMockContext({ canAddCustomer: false });
      const result = checkLimit(context, "customer");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Customer limit reached");
    });

    it("allows adding tour when under limit", () => {
      const context = createMockContext({ canAddTour: true });
      const result = checkLimit(context, "tour");
      expect(result.allowed).toBe(true);
    });

    it("blocks adding tour when at limit", () => {
      const context = createMockContext({ canAddTour: false });
      const result = checkLimit(context, "tour");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Tour limit reached");
    });

    it("allows adding booking when under limit", () => {
      const context = createMockContext({ canAddBooking: true });
      const result = checkLimit(context, "booking");
      expect(result.allowed).toBe(true);
    });

    it("blocks adding booking when at limit", () => {
      const context = createMockContext({ canAddBooking: false });
      const result = checkLimit(context, "booking");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Monthly booking limit reached");
    });

    it("always allows for premium users", () => {
      const context = createMockContext({
        isPremium: true,
        canAddCustomer: true,
        canAddTour: true,
        canAddBooking: true,
        limits: PREMIUM_LIMITS,
      });

      expect(checkLimit(context, "customer").allowed).toBe(true);
      expect(checkLimit(context, "tour").allowed).toBe(true);
      expect(checkLimit(context, "booking").allowed).toBe(true);
    });
  });
});
