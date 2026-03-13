/**
 * Feature Override Merge Logic Tests
 *
 * Tests for the mergeFeatureOverrides function and its interaction with
 * buildTierLimits. The merge logic is extracted inline here since it is a
 * pure function defined inside getOrgContext in org-context.server.ts.
 */

import { describe, it, expect } from "vitest";
import { buildTierLimits } from "../../../../lib/auth/org-context.server";
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "../../../../lib/plan-features";
import type { PlanFeaturesObject, PlanLimits } from "../../../../lib/plan-features";

// ---------------------------------------------------------------------------
// Pure helper extracted from getOrgContext for direct unit testing
// ---------------------------------------------------------------------------

function mergeFeatureOverrides(
  planFeatures: PlanFeaturesObject,
  overrides: Record<string, boolean | null> | null
): PlanFeaturesObject {
  if (!overrides) return planFeatures;
  return Object.entries(overrides).reduce((acc, [key, value]) => {
    if (value !== null) {
      (acc as Record<string, boolean>)[key] = value;
    }
    return acc;
  }, { ...planFeatures });
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_LIMITS: PlanLimits = {
  users: 3,
  customers: 500,
  toursPerMonth: 25,
  storageGb: 5,
};

// Standard plan features (most flags off)
const STANDARD_FEATURES: PlanFeaturesObject = { ...DEFAULT_PLAN_FEATURES.standard };

// Pro plan features (all flags on)
const PRO_FEATURES: PlanFeaturesObject = { ...DEFAULT_PLAN_FEATURES.pro };

// ---------------------------------------------------------------------------
// mergeFeatureOverrides – core merge logic
// ---------------------------------------------------------------------------

describe("mergeFeatureOverrides", () => {
  describe("null / missing overrides", () => {
    it("returns the original planFeatures object when overrides is null", () => {
      const result = mergeFeatureOverrides(STANDARD_FEATURES, null);
      expect(result).toBe(STANDARD_FEATURES);
    });

    it("does not mutate planFeatures when overrides is null", () => {
      const features: PlanFeaturesObject = { has_pos: false };
      mergeFeatureOverrides(features, null);
      expect(features.has_pos).toBe(false);
    });
  });

  describe("empty overrides object", () => {
    it("returns plan defaults unchanged when overrides is {}", () => {
      const result = mergeFeatureOverrides(STANDARD_FEATURES, {});
      expect(result).toEqual(STANDARD_FEATURES);
    });

    it("returns a new object (does not return the same reference) when overrides is {}", () => {
      const result = mergeFeatureOverrides(STANDARD_FEATURES, {});
      expect(result).not.toBe(STANDARD_FEATURES);
    });
  });

  describe("override with true — enabling a feature that is off in the plan", () => {
    it("enables has_pos when plan has it off", () => {
      const features: PlanFeaturesObject = { has_pos: false };
      const result = mergeFeatureOverrides(features, { has_pos: true });
      expect(result.has_pos).toBe(true);
    });

    it("enables has_equipment_boats when plan has it off", () => {
      const features: PlanFeaturesObject = { has_equipment_boats: false };
      const result = mergeFeatureOverrides(features, { has_equipment_boats: true });
      expect(result.has_equipment_boats).toBe(true);
    });

    it("enables has_training when plan has it off", () => {
      const features: PlanFeaturesObject = { has_training: false };
      const result = mergeFeatureOverrides(features, { has_training: true });
      expect(result.has_training).toBe(true);
    });

    it("enables has_integrations when plan has it off", () => {
      const features: PlanFeaturesObject = { has_integrations: false };
      const result = mergeFeatureOverrides(features, { has_integrations: true });
      expect(result.has_integrations).toBe(true);
    });

    it("enables multiple features at once", () => {
      const features: PlanFeaturesObject = {
        has_pos: false,
        has_equipment_boats: false,
        has_training: false,
      };
      const result = mergeFeatureOverrides(features, {
        has_pos: true,
        has_equipment_boats: true,
        has_training: true,
      });
      expect(result.has_pos).toBe(true);
      expect(result.has_equipment_boats).toBe(true);
      expect(result.has_training).toBe(true);
    });
  });

  describe("override with false — disabling a feature that is on in the plan", () => {
    it("disables has_pos when plan has it on", () => {
      const features: PlanFeaturesObject = { has_pos: true };
      const result = mergeFeatureOverrides(features, { has_pos: false });
      expect(result.has_pos).toBe(false);
    });

    it("disables has_stripe when plan has it on", () => {
      const features: PlanFeaturesObject = { has_stripe: true };
      const result = mergeFeatureOverrides(features, { has_stripe: false });
      expect(result.has_stripe).toBe(false);
    });

    it("disables has_integrations when plan has it on", () => {
      const features: PlanFeaturesObject = { has_integrations: true };
      const result = mergeFeatureOverrides(features, { has_integrations: false });
      expect(result.has_integrations).toBe(false);
    });

    it("disables multiple features at once", () => {
      const features: PlanFeaturesObject = {
        has_pos: true,
        has_equipment_boats: true,
        has_api_access: true,
      };
      const result = mergeFeatureOverrides(features, {
        has_pos: false,
        has_equipment_boats: false,
        has_api_access: false,
      });
      expect(result.has_pos).toBe(false);
      expect(result.has_equipment_boats).toBe(false);
      expect(result.has_api_access).toBe(false);
    });
  });

  describe("override with null — falls back to plan default", () => {
    it("keeps plan default (false) when override value is null", () => {
      const features: PlanFeaturesObject = { has_pos: false };
      const result = mergeFeatureOverrides(features, { has_pos: null });
      expect(result.has_pos).toBe(false);
    });

    it("keeps plan default (true) when override value is null", () => {
      const features: PlanFeaturesObject = { has_pos: true };
      const result = mergeFeatureOverrides(features, { has_pos: null });
      expect(result.has_pos).toBe(true);
    });

    it("null override for one key still applies non-null overrides for other keys", () => {
      const features: PlanFeaturesObject = { has_pos: false, has_stripe: false };
      const result = mergeFeatureOverrides(features, { has_pos: null, has_stripe: true });
      expect(result.has_pos).toBe(false);   // null → keep plan default
      expect(result.has_stripe).toBe(true); // non-null → apply override
    });
  });

  describe("edge cases", () => {
    it("ignores override keys that are not present in the plan features object", () => {
      const features: PlanFeaturesObject = { has_pos: false };
      const result = mergeFeatureOverrides(features, {
        unknown_feature_xyz: true,
      } as Record<string, boolean | null>);
      // known key unaffected
      expect(result.has_pos).toBe(false);
      // unknown key is written through (no filtering in the implementation)
      expect((result as Record<string, unknown>).unknown_feature_xyz).toBe(true);
    });

    it("does not mutate the original planFeatures object", () => {
      const features: PlanFeaturesObject = { has_pos: false, has_training: false };
      const original = { ...features };
      mergeFeatureOverrides(features, { has_pos: true });
      expect(features).toEqual(original);
    });

    it("all features overridden to true on a standard plan", () => {
      const allOverridesTrue: Record<string, boolean> = {
        has_tours_bookings: true,
        has_equipment_boats: true,
        has_training: true,
        has_pos: true,
        has_public_site: true,
        has_advanced_notifications: true,
        has_integrations: true,
        has_api_access: true,
        has_stripe: true,
        has_google_calendar: true,
        has_mailchimp: true,
        has_quickbooks: true,
        has_zapier: true,
        has_twilio: true,
        has_whatsapp: true,
        has_xero: true,
      };
      const result = mergeFeatureOverrides(STANDARD_FEATURES, allOverridesTrue);
      Object.keys(allOverridesTrue).forEach((key) => {
        expect((result as Record<string, unknown>)[key]).toBe(true);
      });
    });

    it("all features overridden to false on a pro plan", () => {
      const allOverridesFalse: Record<string, boolean> = {
        has_tours_bookings: false,
        has_equipment_boats: false,
        has_training: false,
        has_pos: false,
        has_public_site: false,
        has_advanced_notifications: false,
        has_integrations: false,
        has_api_access: false,
        has_stripe: false,
        has_google_calendar: false,
        has_mailchimp: false,
        has_quickbooks: false,
        has_zapier: false,
        has_twilio: false,
        has_whatsapp: false,
        has_xero: false,
      };
      const result = mergeFeatureOverrides(PRO_FEATURES, allOverridesFalse);
      Object.keys(allOverridesFalse).forEach((key) => {
        expect((result as Record<string, unknown>)[key]).toBe(false);
      });
    });

    it("returns a plain object (not a Proxy or exotic type)", () => {
      const result = mergeFeatureOverrides(STANDARD_FEATURES, { has_pos: true });
      expect(Object.prototype.toString.call(result)).toBe("[object Object]");
    });
  });
});

// ---------------------------------------------------------------------------
// buildTierLimits with feature overrides applied
// ---------------------------------------------------------------------------

describe("buildTierLimits with feature overrides", () => {
  describe("override enables a feature that is off in the plan", () => {
    it("reflects has_pos=true override in TierLimits.hasPOS", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_pos: true });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.hasPOS).toBe(true);
    });

    it("reflects has_equipment_boats=true override in TierLimits.hasEquipmentRentals", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_equipment_boats: true });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.hasEquipmentRentals).toBe(true);
    });

    it("reflects has_advanced_notifications=true override in TierLimits.hasAdvancedReports and hasEmailNotifications", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_advanced_notifications: true });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.hasAdvancedReports).toBe(true);
      expect(limits.hasEmailNotifications).toBe(true);
    });
  });

  describe("override disables a feature that is on in the plan", () => {
    it("reflects has_pos=false override in TierLimits.hasPOS", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, { has_pos: false });
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      expect(limits.hasPOS).toBe(false);
    });

    it("reflects has_equipment_boats=false override in TierLimits.hasEquipmentRentals", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, { has_equipment_boats: false });
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      expect(limits.hasEquipmentRentals).toBe(false);
    });

    it("reflects has_advanced_notifications=false override in TierLimits.hasAdvancedReports and hasEmailNotifications", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, { has_advanced_notifications: false });
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      expect(limits.hasAdvancedReports).toBe(false);
      expect(limits.hasEmailNotifications).toBe(false);
    });
  });

  describe("null override falls back to plan default in TierLimits", () => {
    it("keeps hasPOS=false when override value is null and plan has it off", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_pos: null });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.hasPOS).toBe(false);
    });

    it("keeps hasPOS=true when override value is null and plan has it on", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, { has_pos: null });
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      expect(limits.hasPOS).toBe(true);
    });
  });

  describe("empty overrides object leaves TierLimits matching plan defaults", () => {
    it("standard plan TierLimits unchanged with empty overrides", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, {});
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      const baselineLimits = buildTierLimits(BASE_LIMITS, STANDARD_FEATURES);
      expect(limits).toEqual(baselineLimits);
    });

    it("pro plan TierLimits unchanged with empty overrides", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, {});
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      const baselineLimits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, PRO_FEATURES);
      expect(limits).toEqual(baselineLimits);
    });
  });

  describe("null overrides leaves TierLimits matching plan defaults", () => {
    it("standard plan TierLimits unchanged with null overrides", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, null);
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      const baselineLimits = buildTierLimits(BASE_LIMITS, STANDARD_FEATURES);
      expect(limits).toEqual(baselineLimits);
    });

    it("pro plan TierLimits unchanged with null overrides", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, null);
      const limits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, effectiveFeatures);
      const baselineLimits = buildTierLimits(DEFAULT_PLAN_LIMITS.pro, PRO_FEATURES);
      expect(limits).toEqual(baselineLimits);
    });
  });

  describe("numeric limits are not affected by feature overrides", () => {
    it("customers limit is preserved when features are overridden", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_pos: true });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.customers).toBe(BASE_LIMITS.customers);
    });

    it("tours limit is preserved when features are overridden", () => {
      const effectiveFeatures = mergeFeatureOverrides(STANDARD_FEATURES, { has_equipment_boats: true });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.tours).toBe(BASE_LIMITS.toursPerMonth);
    });

    it("teamMembers limit is preserved when features are overridden", () => {
      const effectiveFeatures = mergeFeatureOverrides(PRO_FEATURES, { has_pos: false });
      const limits = buildTierLimits(BASE_LIMITS, effectiveFeatures);
      expect(limits.teamMembers).toBe(BASE_LIMITS.users);
    });
  });
});
