/**
 * Extended Organization Context Tests
 *
 * Additional tests for org-context.server functions not covered in tenant-auth.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAdminSubdomain,
  getSubdomainFromRequest,
  requireRole,
  requirePremium,
  checkLimit,
  type OrgContext,
  type OrgRole,
  type PremiumFeature,
  FREE_TIER_LIMITS,
  PREMIUM_LIMITS,
} from "../../../../lib/auth/org-context.server";

describe("org-context.server - extended tests", () => {
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

  describe("isAdminSubdomain", () => {
    it("returns true for admin subdomain on localhost", () => {
      const request = new Request("http://admin.localhost:5173/dashboard");
      expect(isAdminSubdomain(request)).toBe(true);
    });

    it("returns true for admin subdomain on production", () => {
      const request = new Request("https://admin.divestreams.com/dashboard");
      expect(isAdminSubdomain(request)).toBe(true);
    });

    it("returns false for non-admin subdomains", () => {
      const request = new Request("http://demo.localhost:5173/app");
      expect(isAdminSubdomain(request)).toBe(false);
    });

    it("returns false for plain localhost", () => {
      const request = new Request("http://localhost:5173/");
      expect(isAdminSubdomain(request)).toBe(false);
    });

    it("returns false for main domain", () => {
      const request = new Request("https://divestreams.com/");
      expect(isAdminSubdomain(request)).toBe(false);
    });
  });

  describe("requireRole", () => {
    it("allows owner when owner is permitted", () => {
      const context = createMockContext({ membership: { role: "owner" } as any });
      expect(() => requireRole(context, ["owner"])).not.toThrow();
    });

    it("allows admin when admin is permitted", () => {
      const context = createMockContext({ membership: { role: "admin" } as any });
      expect(() => requireRole(context, ["admin", "owner"])).not.toThrow();
    });

    it("allows staff when staff is permitted", () => {
      const context = createMockContext({ membership: { role: "staff" } as any });
      expect(() => requireRole(context, ["staff", "admin", "owner"])).not.toThrow();
    });

    it("throws 403 when role is not permitted", () => {
      const context = createMockContext({ membership: { role: "staff" } as any });

      try {
        requireRole(context, ["owner", "admin"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
      }
    });

    it("throws with appropriate error message", async () => {
      const context = createMockContext({ membership: { role: "customer" } as any });

      try {
        requireRole(context, ["owner"]);
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Forbidden");
        expect(text).toContain("Insufficient permissions");
      }
    });

    it("allows multiple roles", () => {
      const context = createMockContext({ membership: { role: "admin" } as any });
      expect(() => requireRole(context, ["owner", "admin", "staff"])).not.toThrow();
    });
  });

  describe("requirePremium", () => {
    it("does not throw when organization is premium", () => {
      const context = createMockContext({ isPremium: true });
      expect(() => requirePremium(context, "pos")).not.toThrow();
    });

    it("throws 403 when organization is not premium", () => {
      const context = createMockContext({ isPremium: false });

      try {
        requirePremium(context, "pos");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        expect(response.statusText).toBe("Premium Required");
      }
    });

    it("includes feature name in error message for pos", async () => {
      const context = createMockContext({ isPremium: false });

      try {
        requirePremium(context, "pos");
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Point of Sale");
      }
    });

    it("includes feature name in error message for equipment_rentals", async () => {
      const context = createMockContext({ isPremium: false });

      try {
        requirePremium(context, "equipment_rentals");
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Equipment Rentals");
      }
    });

    it("includes feature name in error message for advanced_reports", async () => {
      const context = createMockContext({ isPremium: false });

      try {
        requirePremium(context, "advanced_reports");
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Advanced Reports");
      }
    });

    it("includes feature name in error message for email_notifications", async () => {
      const context = createMockContext({ isPremium: false });

      try {
        requirePremium(context, "email_notifications");
      } catch (error) {
        const response = error as Response;
        const text = await response.text();
        expect(text).toContain("Email Notifications");
      }
    });

    it("handles all premium features", () => {
      const features: PremiumFeature[] = [
        "pos",
        "equipment_rentals",
        "advanced_reports",
        "email_notifications",
        "unlimited_customers",
        "unlimited_tours",
        "unlimited_bookings",
        "unlimited_team",
      ];

      const premiumContext = createMockContext({ isPremium: true });
      features.forEach((feature) => {
        expect(() => requirePremium(premiumContext, feature)).not.toThrow();
      });
    });
  });

  describe("TierLimits", () => {
    it("FREE_TIER_LIMITS has correct structure", () => {
      expect(FREE_TIER_LIMITS).toMatchObject({
        customers: expect.any(Number),
        bookingsPerMonth: expect.any(Number),
        tours: expect.any(Number),
        teamMembers: expect.any(Number),
        hasPOS: expect.any(Boolean),
        hasEquipmentRentals: expect.any(Boolean),
        hasAdvancedReports: expect.any(Boolean),
        hasEmailNotifications: expect.any(Boolean),
      });
    });

    it("PREMIUM_LIMITS has correct structure", () => {
      expect(PREMIUM_LIMITS).toMatchObject({
        customers: expect.any(Number),
        bookingsPerMonth: expect.any(Number),
        tours: expect.any(Number),
        teamMembers: expect.any(Number),
        hasPOS: expect.any(Boolean),
        hasEquipmentRentals: expect.any(Boolean),
        hasAdvancedReports: expect.any(Boolean),
        hasEmailNotifications: expect.any(Boolean),
      });
    });

    it("PREMIUM_LIMITS has all features enabled", () => {
      expect(PREMIUM_LIMITS.hasPOS).toBe(true);
      expect(PREMIUM_LIMITS.hasEquipmentRentals).toBe(true);
      expect(PREMIUM_LIMITS.hasAdvancedReports).toBe(true);
      expect(PREMIUM_LIMITS.hasEmailNotifications).toBe(true);
    });

    it("FREE_TIER_LIMITS has all features disabled", () => {
      expect(FREE_TIER_LIMITS.hasPOS).toBe(false);
      expect(FREE_TIER_LIMITS.hasEquipmentRentals).toBe(false);
      expect(FREE_TIER_LIMITS.hasAdvancedReports).toBe(false);
      expect(FREE_TIER_LIMITS.hasEmailNotifications).toBe(false);
    });

    it("FREE_TIER_LIMITS has specific numeric limits", () => {
      expect(FREE_TIER_LIMITS.customers).toBe(50);
      expect(FREE_TIER_LIMITS.bookingsPerMonth).toBe(20);
      expect(FREE_TIER_LIMITS.tours).toBe(3);
      expect(FREE_TIER_LIMITS.teamMembers).toBe(1);
    });

    it("PREMIUM_LIMITS has unlimited numeric values", () => {
      expect(PREMIUM_LIMITS.customers).toBe(Infinity);
      expect(PREMIUM_LIMITS.bookingsPerMonth).toBe(Infinity);
      expect(PREMIUM_LIMITS.tours).toBe(Infinity);
      expect(PREMIUM_LIMITS.teamMembers).toBe(Infinity);
    });
  });

  describe("getSubdomainFromRequest", () => {
    it("extracts subdomain from localhost", () => {
      const request = new Request("http://demo.localhost:5173/dashboard");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });

    it("extracts subdomain from production domain", () => {
      const request = new Request("https://reef-divers.divestreams.com/bookings");
      expect(getSubdomainFromRequest(request)).toBe("reef-divers");
    });

    it("returns null for plain localhost", () => {
      const request = new Request("http://localhost:5173/");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for main domain without subdomain", () => {
      const request = new Request("https://divestreams.com/");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for www subdomain", () => {
      const request = new Request("https://www.divestreams.com/");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("converts subdomain to lowercase", () => {
      const request = new Request("http://DEMO.localhost:5173/");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });

    it("handles mixed case production domains", () => {
      const request = new Request("https://DemoShop.divestreams.com/");
      expect(getSubdomainFromRequest(request)).toBe("demoshop");
    });

    it("handles subdomain with numbers", () => {
      const request = new Request("http://shop123.localhost:5173/");
      expect(getSubdomainFromRequest(request)).toBe("shop123");
    });

    it("handles subdomain with hyphens", () => {
      const request = new Request("http://my-dive-shop.localhost:5173/");
      expect(getSubdomainFromRequest(request)).toBe("my-dive-shop");
    });

    it("handles deep nested paths", () => {
      const request = new Request("http://test.localhost:5173/app/customers/123/edit");
      expect(getSubdomainFromRequest(request)).toBe("test");
    });

    it("handles query parameters", () => {
      const request = new Request("http://demo.localhost:5173/search?q=test&page=1");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });
  });

  describe("checkLimit", () => {
    it("returns allowed=true for customer when under limit", () => {
      const context = createMockContext({
        canAddCustomer: true,
        limits: { ...FREE_TIER_LIMITS, customers: 50 },
      });
      const result = checkLimit(context, "customer");
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("returns allowed=false with message for customer when at limit", () => {
      const context = createMockContext({
        canAddCustomer: false,
        limits: { ...FREE_TIER_LIMITS, customers: 50 },
      });
      const result = checkLimit(context, "customer");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Customer limit reached");
      expect(result.message).toContain("50");
      expect(result.message).toContain("Upgrade to premium");
    });

    it("returns allowed=true for tour when under limit", () => {
      const context = createMockContext({
        canAddTour: true,
        limits: { ...FREE_TIER_LIMITS, tours: 3 },
      });
      const result = checkLimit(context, "tour");
      expect(result.allowed).toBe(true);
    });

    it("returns allowed=false with message for tour when at limit", () => {
      const context = createMockContext({
        canAddTour: false,
        limits: { ...FREE_TIER_LIMITS, tours: 3 },
      });
      const result = checkLimit(context, "tour");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Tour limit reached");
      expect(result.message).toContain("3");
    });

    it("returns allowed=true for booking when under limit", () => {
      const context = createMockContext({
        canAddBooking: true,
        limits: { ...FREE_TIER_LIMITS, bookingsPerMonth: 20 },
      });
      const result = checkLimit(context, "booking");
      expect(result.allowed).toBe(true);
    });

    it("returns allowed=false with message for booking when at limit", () => {
      const context = createMockContext({
        canAddBooking: false,
        limits: { ...FREE_TIER_LIMITS, bookingsPerMonth: 20 },
      });
      const result = checkLimit(context, "booking");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Monthly booking limit reached");
      expect(result.message).toContain("20");
    });

    it("returns allowed=true for premium users regardless of count", () => {
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

  describe("OrgContext interface", () => {
    it("context has all required properties", () => {
      const context = createMockContext();
      expect(context).toHaveProperty("user");
      expect(context).toHaveProperty("session");
      expect(context).toHaveProperty("org");
      expect(context).toHaveProperty("membership");
      expect(context).toHaveProperty("subscription");
      expect(context).toHaveProperty("limits");
      expect(context).toHaveProperty("usage");
      expect(context).toHaveProperty("canAddCustomer");
      expect(context).toHaveProperty("canAddTour");
      expect(context).toHaveProperty("canAddBooking");
      expect(context).toHaveProperty("isPremium");
    });

    it("usage has all required properties", () => {
      const context = createMockContext();
      expect(context.usage).toHaveProperty("customers");
      expect(context.usage).toHaveProperty("tours");
      expect(context.usage).toHaveProperty("bookingsThisMonth");
    });
  });

  describe("OrgRole type coverage", () => {
    it("recognizes all valid roles", () => {
      const roles: OrgRole[] = ["owner", "admin", "staff", "customer"];
      roles.forEach((role) => {
        const context = createMockContext({ membership: { role } as any });
        expect(context.membership.role).toBe(role);
      });
    });
  });

  describe("PremiumFeature type coverage", () => {
    it("recognizes all premium features", () => {
      const features: PremiumFeature[] = [
        "pos",
        "equipment_rentals",
        "advanced_reports",
        "email_notifications",
        "unlimited_customers",
        "unlimited_tours",
        "unlimited_bookings",
        "unlimited_team",
      ];
      expect(features).toHaveLength(8);
    });
  });
});
