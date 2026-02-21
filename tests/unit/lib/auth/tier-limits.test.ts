/**
 * Tier Limits Tests
 *
 * Comprehensive tests for buildTierLimits function and tier limit constants.
 * Tests the conversion between database plan schema and OrgContext tier limits.
 */

import { describe, it, expect } from "vitest";
import {
  buildTierLimits,
  FREE_TIER_LIMITS,
  PREMIUM_LIMITS,
} from "../../../../lib/auth/org-context.server";
import type { PlanLimits, PlanFeaturesObject } from "../../../../lib/plan-features";

describe("buildTierLimits", () => {
  // ============================================================================
  // Basic Functionality
  // ============================================================================

  describe("Basic functionality", () => {
    it("should convert plan limits to tier limits", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: 10,
        storageGb: 5,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(100);
      expect(tierLimits.bookingsPerMonth).toBe(10);
      expect(tierLimits.tours).toBe(10);
      expect(tierLimits.teamMembers).toBe(5);
      expect(tierLimits.hasPOS).toBe(true);
      expect(tierLimits.hasEquipmentRentals).toBe(true);
      expect(tierLimits.hasAdvancedReports).toBe(true);
      expect(tierLimits.hasEmailNotifications).toBe(true);
    });

    it("should map toursPerMonth to both tours and bookingsPerMonth", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 50,
        toursPerMonth: 25,
        storageGb: 1,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.tours).toBe(25);
      expect(tierLimits.bookingsPerMonth).toBe(25);
    });

    it("should map users to teamMembers", () => {
      const planLimits: PlanLimits = {
        users: 3,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.teamMembers).toBe(3);
    });

    it("should handle zero limits", () => {
      const planLimits: PlanLimits = {
        users: 0,
        customers: 0,
        toursPerMonth: 0,
        storageGb: 0,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(0);
      expect(tierLimits.bookingsPerMonth).toBe(0);
      expect(tierLimits.tours).toBe(0);
      expect(tierLimits.teamMembers).toBe(0);
    });
  });

  // ============================================================================
  // Unlimited (-1) Handling
  // ============================================================================

  describe("Unlimited limits (-1 handling)", () => {
    it("should convert -1 customers to Infinity", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: -1,
        toursPerMonth: 10,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(Infinity);
    });

    it("should convert -1 toursPerMonth to Infinity for both tours and bookings", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: -1,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.tours).toBe(Infinity);
      expect(tierLimits.bookingsPerMonth).toBe(Infinity);
    });

    it("should convert -1 users to Infinity", () => {
      const planLimits: PlanLimits = {
        users: -1,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.teamMembers).toBe(Infinity);
    });

    it("should handle all limits as -1", () => {
      const planLimits: PlanLimits = {
        users: -1,
        customers: -1,
        toursPerMonth: -1,
        storageGb: -1,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(Infinity);
      expect(tierLimits.bookingsPerMonth).toBe(Infinity);
      expect(tierLimits.tours).toBe(Infinity);
      expect(tierLimits.teamMembers).toBe(Infinity);
    });

    it("should handle mixed limited and unlimited values", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: -1,
        toursPerMonth: 20,
        storageGb: -1,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(Infinity);
      expect(tierLimits.bookingsPerMonth).toBe(20);
      expect(tierLimits.tours).toBe(20);
      expect(tierLimits.teamMembers).toBe(5);
    });
  });

  // ============================================================================
  // Feature Flags
  // ============================================================================

  describe("Feature flags", () => {
    it("should map has_pos to hasPOS", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const featuresTrue: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const featuresFalse: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      expect(buildTierLimits(planLimits, featuresTrue).hasPOS).toBe(true);
      expect(buildTierLimits(planLimits, featuresFalse).hasPOS).toBe(false);
    });

    it("should map has_equipment_boats to hasEquipmentRentals", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const featuresTrue: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: true,
        has_advanced_notifications: false,
      };

      const featuresFalse: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      expect(buildTierLimits(planLimits, featuresTrue).hasEquipmentRentals).toBe(true);
      expect(buildTierLimits(planLimits, featuresFalse).hasEquipmentRentals).toBe(false);
    });

    it("should map has_advanced_notifications to both hasAdvancedReports and hasEmailNotifications", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const featuresTrue: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: true,
      };

      const featuresFalse: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimitsTrue = buildTierLimits(planLimits, featuresTrue);
      const tierLimitsFalse = buildTierLimits(planLimits, featuresFalse);

      expect(tierLimitsTrue.hasAdvancedReports).toBe(true);
      expect(tierLimitsTrue.hasEmailNotifications).toBe(true);
      expect(tierLimitsFalse.hasAdvancedReports).toBe(false);
      expect(tierLimitsFalse.hasEmailNotifications).toBe(false);
    });

    it("should handle all features enabled", () => {
      const planLimits: PlanLimits = {
        users: 10,
        customers: 1000,
        toursPerMonth: 100,
        storageGb: 50,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.hasPOS).toBe(true);
      expect(tierLimits.hasEquipmentRentals).toBe(true);
      expect(tierLimits.hasAdvancedReports).toBe(true);
      expect(tierLimits.hasEmailNotifications).toBe(true);
    });

    it("should handle all features disabled", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.hasPOS).toBe(false);
      expect(tierLimits.hasEquipmentRentals).toBe(false);
      expect(tierLimits.hasAdvancedReports).toBe(false);
      expect(tierLimits.hasEmailNotifications).toBe(false);
    });

    it("should handle missing feature flags (undefined)", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 10,
        toursPerMonth: 5,
        storageGb: 1,
      };

      const features: PlanFeaturesObject = {
        has_pos: undefined as unknown,
        has_equipment_boats: undefined as unknown,
        has_advanced_notifications: undefined as unknown,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.hasPOS).toBe(false);
      expect(tierLimits.hasEquipmentRentals).toBe(false);
      expect(tierLimits.hasAdvancedReports).toBe(false);
      expect(tierLimits.hasEmailNotifications).toBe(false);
    });
  });

  // ============================================================================
  // Large Numbers
  // ============================================================================

  describe("Large numbers", () => {
    it("should handle very large limits", () => {
      const planLimits: PlanLimits = {
        users: 999999,
        customers: 999999,
        toursPerMonth: 999999,
        storageGb: 999999,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.customers).toBe(999999);
      expect(tierLimits.bookingsPerMonth).toBe(999999);
      expect(tierLimits.tours).toBe(999999);
      expect(tierLimits.teamMembers).toBe(999999);
    });

    it("should preserve exact large numbers", () => {
      const planLimits: PlanLimits = {
        users: 123456,
        customers: 654321,
        toursPerMonth: 789012,
        storageGb: 1000,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.teamMembers).toBe(123456);
      expect(tierLimits.customers).toBe(654321);
      expect(tierLimits.tours).toBe(789012);
      expect(tierLimits.bookingsPerMonth).toBe(789012);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle single user limit", () => {
      const planLimits: PlanLimits = {
        users: 1,
        customers: 1,
        toursPerMonth: 1,
        storageGb: 1,
      };

      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_advanced_notifications: false,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      expect(tierLimits.teamMembers).toBe(1);
      expect(tierLimits.customers).toBe(1);
      expect(tierLimits.tours).toBe(1);
      expect(tierLimits.bookingsPerMonth).toBe(1);
    });

    it("should return a valid TierLimits object", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: false,
        has_advanced_notifications: true,
      };

      const tierLimits = buildTierLimits(planLimits, features);

      // Verify all required properties exist
      expect(tierLimits).toHaveProperty("customers");
      expect(tierLimits).toHaveProperty("bookingsPerMonth");
      expect(tierLimits).toHaveProperty("tours");
      expect(tierLimits).toHaveProperty("teamMembers");
      expect(tierLimits).toHaveProperty("hasPOS");
      expect(tierLimits).toHaveProperty("hasEquipmentRentals");
      expect(tierLimits).toHaveProperty("hasAdvancedReports");
      expect(tierLimits).toHaveProperty("hasEmailNotifications");

      // Verify types
      expect(typeof tierLimits.customers).toBe("number");
      expect(typeof tierLimits.bookingsPerMonth).toBe("number");
      expect(typeof tierLimits.tours).toBe("number");
      expect(typeof tierLimits.teamMembers).toBe("number");
      expect(typeof tierLimits.hasPOS).toBe("boolean");
      expect(typeof tierLimits.hasEquipmentRentals).toBe("boolean");
      expect(typeof tierLimits.hasAdvancedReports).toBe("boolean");
      expect(typeof tierLimits.hasEmailNotifications).toBe("boolean");
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe("Constants", () => {
    describe("FREE_TIER_LIMITS", () => {
      it("should have valid structure", () => {
        expect(FREE_TIER_LIMITS).toHaveProperty("customers");
        expect(FREE_TIER_LIMITS).toHaveProperty("bookingsPerMonth");
        expect(FREE_TIER_LIMITS).toHaveProperty("tours");
        expect(FREE_TIER_LIMITS).toHaveProperty("teamMembers");
        expect(FREE_TIER_LIMITS).toHaveProperty("hasPOS");
        expect(FREE_TIER_LIMITS).toHaveProperty("hasEquipmentRentals");
        expect(FREE_TIER_LIMITS).toHaveProperty("hasAdvancedReports");
        expect(FREE_TIER_LIMITS).toHaveProperty("hasEmailNotifications");
      });

      it("should have numeric limits", () => {
        expect(typeof FREE_TIER_LIMITS.customers).toBe("number");
        expect(typeof FREE_TIER_LIMITS.bookingsPerMonth).toBe("number");
        expect(typeof FREE_TIER_LIMITS.tours).toBe("number");
        expect(typeof FREE_TIER_LIMITS.teamMembers).toBe("number");
      });

      it("should have boolean feature flags", () => {
        expect(typeof FREE_TIER_LIMITS.hasPOS).toBe("boolean");
        expect(typeof FREE_TIER_LIMITS.hasEquipmentRentals).toBe("boolean");
        expect(typeof FREE_TIER_LIMITS.hasAdvancedReports).toBe("boolean");
        expect(typeof FREE_TIER_LIMITS.hasEmailNotifications).toBe("boolean");
      });

      it("should have finite limits", () => {
        expect(FREE_TIER_LIMITS.customers).toBeGreaterThan(0);
        expect(FREE_TIER_LIMITS.bookingsPerMonth).toBeGreaterThan(0);
        expect(FREE_TIER_LIMITS.tours).toBeGreaterThan(0);
        expect(FREE_TIER_LIMITS.teamMembers).toBeGreaterThan(0);
      });
    });

    describe("PREMIUM_LIMITS", () => {
      it("should have valid structure", () => {
        expect(PREMIUM_LIMITS).toHaveProperty("customers");
        expect(PREMIUM_LIMITS).toHaveProperty("bookingsPerMonth");
        expect(PREMIUM_LIMITS).toHaveProperty("tours");
        expect(PREMIUM_LIMITS).toHaveProperty("teamMembers");
        expect(PREMIUM_LIMITS).toHaveProperty("hasPOS");
        expect(PREMIUM_LIMITS).toHaveProperty("hasEquipmentRentals");
        expect(PREMIUM_LIMITS).toHaveProperty("hasAdvancedReports");
        expect(PREMIUM_LIMITS).toHaveProperty("hasEmailNotifications");
      });

      it("should have higher limits than free tier", () => {
        // Premium should have at least same or higher limits
        expect(PREMIUM_LIMITS.customers).toBeGreaterThanOrEqual(FREE_TIER_LIMITS.customers);
        expect(PREMIUM_LIMITS.bookingsPerMonth).toBeGreaterThanOrEqual(FREE_TIER_LIMITS.bookingsPerMonth);
        expect(PREMIUM_LIMITS.tours).toBeGreaterThanOrEqual(FREE_TIER_LIMITS.tours);
        expect(PREMIUM_LIMITS.teamMembers).toBeGreaterThanOrEqual(FREE_TIER_LIMITS.teamMembers);
      });

      it("should have all features enabled", () => {
        // Premium plans should have all features
        expect(PREMIUM_LIMITS.hasPOS).toBe(true);
        expect(PREMIUM_LIMITS.hasEquipmentRentals).toBe(true);
        expect(PREMIUM_LIMITS.hasAdvancedReports).toBe(true);
        expect(PREMIUM_LIMITS.hasEmailNotifications).toBe(true);
      });
    });
  });

  // ============================================================================
  // Immutability Tests
  // ============================================================================

  describe("Immutability", () => {
    it("should not modify input plan limits", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const originalPlanLimits = { ...planLimits };
      const originalFeatures = { ...features };

      buildTierLimits(planLimits, features);

      expect(planLimits).toEqual(originalPlanLimits);
      expect(features).toEqual(originalFeatures);
    });

    it("should create new object each time", () => {
      const planLimits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_advanced_notifications: true,
      };

      const result1 = buildTierLimits(planLimits, features);
      const result2 = buildTierLimits(planLimits, features);

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });
});
