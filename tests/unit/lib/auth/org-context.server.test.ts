/**
 * Unit tests for lib/auth/org-context.server.ts
 *
 * Core logic tests (buildTierLimits, helpers, type guards) live here.
 * Additional tests are co-located in:
 *   - org-context-extended.test.ts  (requireRole, requirePremium, checkLimit, getSubdomainFromRequest)
 *   - org-context-cache.test.ts     (Redis caching of getOrgContext)
 *   - tenant-auth.test.ts           (FREE_TIER_LIMITS, PREMIUM_LIMITS, checkLimit)
 */

import { describe, it, expect } from "vitest";
import {
  buildTierLimits,
  FREE_TIER_LIMITS,
  PREMIUM_LIMITS,
  isAdminSubdomain,
  getSubdomainFromRequest,
} from "../../../../lib/auth/org-context.server";
import type { PlanLimits, PlanFeaturesObject } from "../../../../lib/plan-features";

describe("lib/auth/org-context.server", () => {
  describe("buildTierLimits", () => {
    it("maps finite plan limits to TierLimits", () => {
      const planLimits: PlanLimits = { users: 5, customers: 100, toursPerMonth: 10, storageGb: 2 };
      const features: PlanFeaturesObject = { has_pos: true, has_equipment_boats: false, has_advanced_notifications: true };
      const result = buildTierLimits(planLimits, features);

      expect(result.teamMembers).toBe(5);
      expect(result.customers).toBe(100);
      expect(result.tours).toBe(10);
      expect(result.bookingsPerMonth).toBe(10);
      expect(result.hasPOS).toBe(true);
      expect(result.hasEquipmentRentals).toBe(false);
      expect(result.hasAdvancedReports).toBe(true);
      expect(result.hasEmailNotifications).toBe(true);
    });

    it("converts -1 limits to Infinity", () => {
      const planLimits: PlanLimits = { users: -1, customers: -1, toursPerMonth: -1, storageGb: 100 };
      const features: PlanFeaturesObject = {};
      const result = buildTierLimits(planLimits, features);

      expect(result.teamMembers).toBe(Infinity);
      expect(result.customers).toBe(Infinity);
      expect(result.tours).toBe(Infinity);
      expect(result.bookingsPerMonth).toBe(Infinity);
    });

    it("defaults missing feature flags to false", () => {
      const planLimits: PlanLimits = { users: 3, customers: 50, toursPerMonth: 5, storageGb: 1 };
      const result = buildTierLimits(planLimits, {});

      expect(result.hasPOS).toBe(false);
      expect(result.hasEquipmentRentals).toBe(false);
      expect(result.hasAdvancedReports).toBe(false);
      expect(result.hasEmailNotifications).toBe(false);
    });
  });

  describe("FREE_TIER_LIMITS and PREMIUM_LIMITS constants", () => {
    it("FREE_TIER_LIMITS has finite numeric limits", () => {
      expect(FREE_TIER_LIMITS.customers).toBeGreaterThan(0);
      expect(isFinite(FREE_TIER_LIMITS.customers)).toBe(true);
    });

    it("PREMIUM_LIMITS has infinite numeric limits", () => {
      expect(PREMIUM_LIMITS.customers).toBe(Infinity);
      expect(PREMIUM_LIMITS.tours).toBe(Infinity);
      expect(PREMIUM_LIMITS.teamMembers).toBe(Infinity);
      expect(PREMIUM_LIMITS.bookingsPerMonth).toBe(Infinity);
    });

    it("PREMIUM_LIMITS has all features enabled", () => {
      expect(PREMIUM_LIMITS.hasPOS).toBe(true);
      expect(PREMIUM_LIMITS.hasEquipmentRentals).toBe(true);
      expect(PREMIUM_LIMITS.hasAdvancedReports).toBe(true);
      expect(PREMIUM_LIMITS.hasEmailNotifications).toBe(true);
    });
  });

  describe("isAdminSubdomain", () => {
    it("returns true for admin.divestreams.com", () => {
      expect(isAdminSubdomain(new Request("https://admin.divestreams.com/"))).toBe(true);
    });

    it("returns true for admin.localhost", () => {
      expect(isAdminSubdomain(new Request("http://admin.localhost:5173/"))).toBe(true);
    });

    it("returns false for tenant subdomains", () => {
      expect(isAdminSubdomain(new Request("http://demo.localhost:5173/"))).toBe(false);
    });
  });

  describe("getSubdomainFromRequest", () => {
    it("extracts subdomain from tenant URL", () => {
      expect(getSubdomainFromRequest(new Request("http://acme.localhost:5173/"))).toBe("acme");
    });

    it("returns null for plain localhost", () => {
      expect(getSubdomainFromRequest(new Request("http://localhost:5173/"))).toBeNull();
    });

    it("returns null for www subdomain", () => {
      expect(getSubdomainFromRequest(new Request("https://www.divestreams.com/"))).toBeNull();
    });
  });
});
