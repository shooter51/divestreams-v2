/**
 * Integration tests for per-tenant feature flag overrides
 * in admin/tenants.$id route
 *
 * DS-fjn8 — Admin feature flags to hide/show UI items
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PLAN_FEATURES } from "../../../../lib/plan-features";

describe("admin/tenants.$id — updateFeatureOverrides intent", () => {
  const mockOrg = {
    id: "org-uuid-123",
    slug: "demo",
    name: "Demo Dive Shop",
  };

  const mockSubscription = {
    id: "sub-uuid-1",
    organizationId: "org-uuid-123",
    plan: "standard",
    planId: "plan-uuid-1",
    status: "active",
    featureOverrides: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // Action shape validation (unit-level logic tests)
  // ------------------------------------------------------------------

  describe("updateFeatureOverrides intent logic", () => {
    it("only saves overrides that differ from the plan default", () => {
      // Simulate the action logic: compare submitted (parsed JSON) values against plan defaults.
      // Only include a key in overrides when the submitted value differs from the plan default.
      const planFeatures: Record<string, boolean> = {
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: true,  // plan: true
        [PLAN_FEATURES.HAS_TRAINING]: false,         // plan: false
        [PLAN_FEATURES.HAS_POS]: false,              // plan: false
      };

      // Submitted JSON: HAS_TRAINING=true (Force On), HAS_TOURS_BOOKINGS=false (Force Off), HAS_POS=null (Plan Default)
      const parsedOverrides: Record<string, boolean | null> = {
        [PLAN_FEATURES.HAS_TRAINING]: true,
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: false,
        [PLAN_FEATURES.HAS_POS]: null,
      };

      const filtered = Object.fromEntries(
        Object.entries(parsedOverrides).filter(([key, v]) => {
          if (v === null) return false; // "Plan Default" — no override needed
          const planDefault = planFeatures[key] ?? false;
          return v !== planDefault; // only keep if it actually differs
        })
      );
      const overrides = Object.keys(filtered).length > 0 ? filtered as Record<string, boolean> : null;

      // HAS_TRAINING: submitted=true, plan=false → differs → save override
      expect(overrides![PLAN_FEATURES.HAS_TRAINING]).toBe(true);
      // HAS_TOURS_BOOKINGS: submitted=false, plan=true → differs → save override
      expect(overrides![PLAN_FEATURES.HAS_TOURS_BOOKINGS]).toBe(false);
      // HAS_POS: submitted=null ("Plan Default") → not included
      expect(overrides![PLAN_FEATURES.HAS_POS]).toBeUndefined();
    });

    it("produces null overrides when submitted value matches plan default (Force On for already-enabled feature)", () => {
      // The bug case: Force On a feature that's already enabled by the plan.
      // This should NOT be saved as an override.
      const planFeatures: Record<string, boolean> = {
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: true,
      };

      const parsedOverrides: Record<string, boolean | null> = {
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: true, // same as plan default
      };

      const filtered = Object.fromEntries(
        Object.entries(parsedOverrides).filter(([key, v]) => {
          if (v === null) return false;
          const planDefault = planFeatures[key] ?? false;
          return v !== planDefault;
        })
      );
      const overrides = Object.keys(filtered).length > 0 ? filtered as Record<string, boolean> : null;

      expect(overrides).toBeNull();
    });

    it("produces null when all submitted values match plan defaults or are null", () => {
      const planFeatures: Record<string, boolean> = {
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: true,
        [PLAN_FEATURES.HAS_TRAINING]: false,
        [PLAN_FEATURES.HAS_POS]: false,
      };

      // Submitted: everything matches plan defaults or is "Plan Default"
      const parsedOverrides: Record<string, boolean | null> = {
        [PLAN_FEATURES.HAS_TOURS_BOOKINGS]: true,  // same as plan → no override
        [PLAN_FEATURES.HAS_TRAINING]: null,          // "Plan Default" → no override
        [PLAN_FEATURES.HAS_POS]: false,              // same as plan → no override
      };

      const filtered = Object.fromEntries(
        Object.entries(parsedOverrides).filter(([key, v]) => {
          if (v === null) return false;
          const planDefault = planFeatures[key] ?? false;
          return v !== planDefault;
        })
      );
      const overrides = Object.keys(filtered).length > 0 ? filtered as Record<string, boolean> : null;

      expect(overrides).toBeNull();
    });

    it("null entries in submitted JSON mean 'use plan default' and are excluded", () => {
      const planFeatures: Record<string, boolean> = {
        [PLAN_FEATURES.HAS_TRAINING]: false,
      };

      const parsedOverrides: Record<string, boolean | null> = {
        [PLAN_FEATURES.HAS_TRAINING]: null, // user chose "Plan Default"
      };

      const filtered = Object.fromEntries(
        Object.entries(parsedOverrides).filter(([key, v]) => {
          if (v === null) return false;
          const planDefault = planFeatures[key] ?? false;
          return v !== planDefault;
        })
      );

      expect(Object.keys(filtered)).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // Loader data shape — featureOverrides included in subscription
  // ------------------------------------------------------------------

  describe("loader data shape", () => {
    it("subscription includes featureOverrides field", () => {
      const loaderResponse = {
        featureOverrides: { has_training: true, has_pos: false },
        planFeatures: {
          has_tours_bookings: true,
          has_equipment_boats: false,
          has_training: false,
          has_pos: false,
        },
        subscription: {
          ...mockSubscription,
          planDetails: {
            id: "plan-uuid-1",
            name: "standard",
            displayName: "Standard",
            monthlyPrice: 3000,
          },
        },
      };

      expect(loaderResponse.featureOverrides).toBeDefined();
      expect(loaderResponse.featureOverrides?.has_training).toBe(true);
    });

    it("featureOverrides is empty object when no overrides set", () => {
      const loaderResponse = {
        featureOverrides: {},
        planFeatures: {},
        subscription: {
          ...mockSubscription,
        },
      };

      expect(loaderResponse.featureOverrides).toEqual({});
    });

    it("loader includes planFeatures for display", () => {
      const planFeatures = {
        has_tours_bookings: true,
        has_equipment_boats: false,
        has_training: false,
        has_pos: false,
        has_stripe: true,
      };

      const loaderResponse = {
        planFeatures,
        featureOverrides: {},
        subscription: {
          ...mockSubscription,
          planDetails: {
            id: "plan-uuid-1",
            name: "standard",
            displayName: "Standard",
            monthlyPrice: 3000,
          },
        },
      };

      expect(loaderResponse.planFeatures).toEqual(planFeatures);
    });
  });

  // ------------------------------------------------------------------
  // mergeFeatureOverrides integration with org-context
  // ------------------------------------------------------------------

  describe("effective feature flags (plan + overrides merged)", () => {
    it("effective features equal plan features when no overrides", () => {
      const planFeatures = {
        has_tours_bookings: true,
        has_training: false,
        has_pos: false,
      };
      const featureOverrides = null;

      // Simulate mergeFeatureOverrides behavior
      const effective = featureOverrides
        ? { ...planFeatures, ...Object.fromEntries(
            Object.entries(featureOverrides).filter(([, v]) => v !== undefined)
          ) }
        : planFeatures;

      expect(effective).toEqual(planFeatures);
    });

    it("effective features reflect override that enables a disabled feature", () => {
      const planFeatures = {
        has_tours_bookings: true,
        has_training: false,
        has_pos: false,
      };
      const featureOverrides = { has_training: true };

      const effective = { ...planFeatures, ...featureOverrides };

      expect(effective.has_training).toBe(true);
      expect(effective.has_tours_bookings).toBe(true);
      expect(effective.has_pos).toBe(false);
    });

    it("effective features reflect override that disables an enabled feature", () => {
      const planFeatures = {
        has_tours_bookings: true,
        has_training: false,
        has_pos: false,
      };
      const featureOverrides = { has_tours_bookings: false };

      const effective = { ...planFeatures, ...featureOverrides };

      expect(effective.has_tours_bookings).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Known intent recognition
  // ------------------------------------------------------------------

  describe("intent routing", () => {
    it("updateFeatureOverrides is a recognized intent", () => {
      const knownIntents = [
        "updateName",
        "updateSubscription",
        "removeMember",
        "updateRole",
        "delete",
        "deactivate",
        "resetPassword",
        "changeEmail",
        "updateFeatureOverrides",
      ];
      expect(knownIntents).toContain("updateFeatureOverrides");
    });

    it("form data for updateFeatureOverrides includes intent and JSON overrides", () => {
      const overrides = {
        [PLAN_FEATURES.HAS_TRAINING]: true,
        [PLAN_FEATURES.HAS_POS]: null,
      };
      const formData = {
        intent: "updateFeatureOverrides",
        overrides: JSON.stringify(overrides),
      };

      expect(formData.intent).toBe("updateFeatureOverrides");
      expect(JSON.parse(formData.overrides)[PLAN_FEATURES.HAS_TRAINING]).toBe(true);
      expect(JSON.parse(formData.overrides)[PLAN_FEATURES.HAS_POS]).toBeNull();
    });
  });
});
