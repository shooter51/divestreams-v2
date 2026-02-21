import { describe, it, expect } from "vitest";
import {
  PLAN_FEATURES,
  FEATURE_LABELS,
  FEATURE_UPGRADE_INFO,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  LIMIT_WARNING_THRESHOLD,
  LIMIT_LABELS,
  type PlanFeatureKey,
  type PlanLimits,
  type PlanFeaturesObject,
} from "../../../lib/plan-features";

describe("plan-features", () => {
  describe("PLAN_FEATURES constants", () => {
    it("defines all core feature flags", () => {
      expect(PLAN_FEATURES.HAS_TOURS_BOOKINGS).toBe("has_tours_bookings");
      expect(PLAN_FEATURES.HAS_EQUIPMENT_BOATS).toBe("has_equipment_boats");
      expect(PLAN_FEATURES.HAS_TRAINING).toBe("has_training");
      expect(PLAN_FEATURES.HAS_POS).toBe("has_pos");
      expect(PLAN_FEATURES.HAS_PUBLIC_SITE).toBe("has_public_site");
      expect(PLAN_FEATURES.HAS_ADVANCED_NOTIFICATIONS).toBe("has_advanced_notifications");
      expect(PLAN_FEATURES.HAS_INTEGRATIONS).toBe("has_integrations");
      expect(PLAN_FEATURES.HAS_API_ACCESS).toBe("has_api_access");
    });

    it("defines individual integration flags", () => {
      expect(PLAN_FEATURES.HAS_STRIPE).toBe("has_stripe");
      expect(PLAN_FEATURES.HAS_GOOGLE_CALENDAR).toBe("has_google_calendar");
      expect(PLAN_FEATURES.HAS_MAILCHIMP).toBe("has_mailchimp");
      expect(PLAN_FEATURES.HAS_QUICKBOOKS).toBe("has_quickbooks");
      expect(PLAN_FEATURES.HAS_ZAPIER).toBe("has_zapier");
      expect(PLAN_FEATURES.HAS_TWILIO).toBe("has_twilio");
      expect(PLAN_FEATURES.HAS_WHATSAPP).toBe("has_whatsapp");
      expect(PLAN_FEATURES.HAS_XERO).toBe("has_xero");
    });

    it("has 16 total feature flags", () => {
      expect(Object.keys(PLAN_FEATURES)).toHaveLength(16);
    });
  });

  describe("FEATURE_LABELS", () => {
    it("has a label for every feature", () => {
      const featureValues = Object.values(PLAN_FEATURES);
      for (const feature of featureValues) {
        expect(FEATURE_LABELS[feature]).toBeDefined();
        expect(typeof FEATURE_LABELS[feature]).toBe("string");
      }
    });

    it("has descriptive labels", () => {
      expect(FEATURE_LABELS.has_tours_bookings).toBe("Tours & Bookings");
      expect(FEATURE_LABELS.has_stripe).toBe("Stripe Payments");
      expect(FEATURE_LABELS.has_api_access).toBe("API Access");
    });
  });

  describe("FEATURE_UPGRADE_INFO", () => {
    it("has upgrade info for every feature", () => {
      const featureValues = Object.values(PLAN_FEATURES);
      for (const feature of featureValues) {
        const info = FEATURE_UPGRADE_INFO[feature];
        expect(info).toBeDefined();
        expect(info.title).toBeDefined();
        expect(info.description).toBeDefined();
        expect(typeof info.requiredPlan).toBe("string");
      }
    });

    it("core features specify required plans", () => {
      expect(FEATURE_UPGRADE_INFO.has_tours_bookings.requiredPlan).toBe("Standard");
      expect(FEATURE_UPGRADE_INFO.has_equipment_boats.requiredPlan).toBe("Pro");
      expect(FEATURE_UPGRADE_INFO.has_training.requiredPlan).toBe("Pro");
      expect(FEATURE_UPGRADE_INFO.has_integrations.requiredPlan).toBe("Pro");
      expect(FEATURE_UPGRADE_INFO.has_api_access.requiredPlan).toBe("Pro");
    });

    it("individual integration features have empty requiredPlan (admin-determined)", () => {
      expect(FEATURE_UPGRADE_INFO.has_stripe.requiredPlan).toBe("");
      expect(FEATURE_UPGRADE_INFO.has_google_calendar.requiredPlan).toBe("");
      expect(FEATURE_UPGRADE_INFO.has_zapier.requiredPlan).toBe("");
    });
  });

  describe("DEFAULT_PLAN_FEATURES", () => {
    it("defines features for both plan tiers", () => {
      expect(DEFAULT_PLAN_FEATURES.standard).toBeDefined();
      expect(DEFAULT_PLAN_FEATURES.pro).toBeDefined();
    });

    it("standard plan has tours_bookings and stripe only", () => {
      const standard = DEFAULT_PLAN_FEATURES.standard;
      expect(standard.has_tours_bookings).toBe(true);
      expect(standard.has_stripe).toBe(true);
      expect(standard.has_equipment_boats).toBe(false);
      expect(standard.has_training).toBe(false);
      expect(standard.has_pos).toBe(false);
      expect(standard.has_public_site).toBe(false);
      expect(standard.has_api_access).toBe(false);
    });

    it("pro plan enables everything", () => {
      const pro = DEFAULT_PLAN_FEATURES.pro;
      const allValues = Object.values(pro);
      expect(allValues.every((v) => v === true)).toBe(true);
    });

    it("features are progressively more inclusive by tier", () => {
      const tiers = ["standard", "pro"];
      for (let i = 0; i < tiers.length - 1; i++) {
        const current = DEFAULT_PLAN_FEATURES[tiers[i]];
        const next = DEFAULT_PLAN_FEATURES[tiers[i + 1]];
        const currentTrueCount = Object.values(current).filter(Boolean).length;
        const nextTrueCount = Object.values(next).filter(Boolean).length;
        expect(nextTrueCount).toBeGreaterThanOrEqual(currentTrueCount);
      }
    });
  });

  describe("DEFAULT_PLAN_LIMITS", () => {
    it("defines limits for both plan tiers", () => {
      expect(DEFAULT_PLAN_LIMITS.standard).toBeDefined();
      expect(DEFAULT_PLAN_LIMITS.pro).toBeDefined();
    });

    it("standard plan has restrictive limits", () => {
      const standard = DEFAULT_PLAN_LIMITS.standard;
      expect(standard.users).toBe(3);
      expect(standard.customers).toBe(500);
      expect(standard.toursPerMonth).toBe(25);
      expect(standard.storageGb).toBe(5);
    });

    it("pro plan uses -1 for unlimited", () => {
      const pro = DEFAULT_PLAN_LIMITS.pro;
      expect(pro.users).toBe(-1);
      expect(pro.customers).toBe(-1);
      expect(pro.toursPerMonth).toBe(-1);
      expect(pro.storageGb).toBe(100);
    });
  });

  describe("LIMIT_WARNING_THRESHOLD", () => {
    it("is set to 80%", () => {
      expect(LIMIT_WARNING_THRESHOLD).toBe(0.8);
    });
  });

  describe("LIMIT_LABELS", () => {
    it("has labels for all limit keys", () => {
      expect(LIMIT_LABELS.users).toBe("Team Members");
      expect(LIMIT_LABELS.customers).toBe("Customers");
      expect(LIMIT_LABELS.toursPerMonth).toBe("Tours per Month");
      expect(LIMIT_LABELS.storageGb).toBe("Storage");
    });
  });

  describe("type exports", () => {
    it("PlanFeatureKey matches feature values", () => {
      const key: PlanFeatureKey = "has_tours_bookings";
      expect(key).toBe("has_tours_bookings");
    });

    it("PlanLimits type is valid", () => {
      const limits: PlanLimits = {
        users: 5,
        customers: 100,
        toursPerMonth: 20,
        storageGb: 10,
      };
      expect(limits.users).toBe(5);
    });

    it("PlanFeaturesObject type accepts optional fields", () => {
      const features: PlanFeaturesObject = {
        has_tours_bookings: true,
        has_stripe: false,
      };
      expect(features.has_tours_bookings).toBe(true);
      expect(features.has_training).toBeUndefined();
    });

    it("PlanFeaturesObject supports descriptions array", () => {
      const features: PlanFeaturesObject = {
        descriptions: ["Feature 1", "Feature 2"],
      };
      expect(features.descriptions).toHaveLength(2);
    });
  });
});
