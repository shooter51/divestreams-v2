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
      expect(FEATURE_UPGRADE_INFO.has_tours_bookings.requiredPlan).toBe("Free");
      expect(FEATURE_UPGRADE_INFO.has_equipment_boats.requiredPlan).toBe("Starter");
      expect(FEATURE_UPGRADE_INFO.has_training.requiredPlan).toBe("Pro");
      expect(FEATURE_UPGRADE_INFO.has_integrations.requiredPlan).toBe("Enterprise");
      expect(FEATURE_UPGRADE_INFO.has_api_access.requiredPlan).toBe("Enterprise");
    });

    it("individual integration features have empty requiredPlan (admin-determined)", () => {
      expect(FEATURE_UPGRADE_INFO.has_stripe.requiredPlan).toBe("");
      expect(FEATURE_UPGRADE_INFO.has_google_calendar.requiredPlan).toBe("");
      expect(FEATURE_UPGRADE_INFO.has_zapier.requiredPlan).toBe("");
    });
  });

  describe("DEFAULT_PLAN_FEATURES", () => {
    it("defines features for all four plan tiers", () => {
      expect(DEFAULT_PLAN_FEATURES.free).toBeDefined();
      expect(DEFAULT_PLAN_FEATURES.starter).toBeDefined();
      expect(DEFAULT_PLAN_FEATURES.pro).toBeDefined();
      expect(DEFAULT_PLAN_FEATURES.enterprise).toBeDefined();
    });

    it("free plan has tours_bookings and stripe only", () => {
      const free = DEFAULT_PLAN_FEATURES.free;
      expect(free.has_tours_bookings).toBe(true);
      expect(free.has_stripe).toBe(true);
      expect(free.has_equipment_boats).toBe(false);
      expect(free.has_training).toBe(false);
      expect(free.has_pos).toBe(false);
      expect(free.has_public_site).toBe(false);
      expect(free.has_api_access).toBe(false);
    });

    it("starter plan adds equipment, boats, and public site", () => {
      const starter = DEFAULT_PLAN_FEATURES.starter;
      expect(starter.has_tours_bookings).toBe(true);
      expect(starter.has_equipment_boats).toBe(true);
      expect(starter.has_public_site).toBe(true);
      expect(starter.has_google_calendar).toBe(true);
      expect(starter.has_training).toBe(false);
      expect(starter.has_pos).toBe(false);
    });

    it("pro plan adds training, POS, and advanced features", () => {
      const pro = DEFAULT_PLAN_FEATURES.pro;
      expect(pro.has_training).toBe(true);
      expect(pro.has_pos).toBe(true);
      expect(pro.has_advanced_notifications).toBe(true);
      expect(pro.has_integrations).toBe(true);
      expect(pro.has_api_access).toBe(false);
    });

    it("enterprise plan enables everything", () => {
      const enterprise = DEFAULT_PLAN_FEATURES.enterprise;
      const allValues = Object.values(enterprise);
      expect(allValues.every((v) => v === true)).toBe(true);
    });

    it("features are progressively more inclusive by tier", () => {
      const tiers = ["free", "starter", "pro", "enterprise"];
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
    it("defines limits for all four plan tiers", () => {
      expect(DEFAULT_PLAN_LIMITS.free).toBeDefined();
      expect(DEFAULT_PLAN_LIMITS.starter).toBeDefined();
      expect(DEFAULT_PLAN_LIMITS.pro).toBeDefined();
      expect(DEFAULT_PLAN_LIMITS.enterprise).toBeDefined();
    });

    it("free plan has most restrictive limits", () => {
      const free = DEFAULT_PLAN_LIMITS.free;
      expect(free.users).toBe(1);
      expect(free.customers).toBe(50);
      expect(free.toursPerMonth).toBe(5);
      expect(free.storageGb).toBe(0.5);
    });

    it("enterprise plan uses -1 for unlimited", () => {
      const enterprise = DEFAULT_PLAN_LIMITS.enterprise;
      expect(enterprise.users).toBe(-1);
      expect(enterprise.customers).toBe(-1);
      expect(enterprise.toursPerMonth).toBe(-1);
      expect(enterprise.storageGb).toBe(100);
    });

    it("limits increase progressively across tiers", () => {
      const tiers = ["free", "starter", "pro"] as const;
      for (let i = 0; i < tiers.length - 1; i++) {
        const current = DEFAULT_PLAN_LIMITS[tiers[i]];
        const next = DEFAULT_PLAN_LIMITS[tiers[i + 1]];
        expect(next.users).toBeGreaterThan(current.users);
        expect(next.customers).toBeGreaterThan(current.customers);
        expect(next.toursPerMonth).toBeGreaterThan(current.toursPerMonth);
        expect(next.storageGb).toBeGreaterThan(current.storageGb);
      }
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
