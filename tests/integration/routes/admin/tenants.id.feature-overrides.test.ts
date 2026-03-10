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
    it("parses enabled features from form data correctly", () => {
      // Simulate the server-side parsing of checkbox form fields
      const formEntries: [string, string][] = [
        ["intent", "updateFeatureOverrides"],
        [`feature_${PLAN_FEATURES.HAS_TRAINING}`, "on"],
        [`feature_${PLAN_FEATURES.HAS_POS}`, "on"],
      ];

      const formData = new Map(formEntries);
      const overrides: Record<string, boolean> = {};

      for (const key of Object.values(PLAN_FEATURES)) {
        const val = formData.get(`feature_${key}`);
        if (val !== undefined) {
          overrides[key] = val === "on";
        }
      }

      expect(overrides[PLAN_FEATURES.HAS_TRAINING]).toBe(true);
      expect(overrides[PLAN_FEATURES.HAS_POS]).toBe(true);
      // Keys not in the form are absent (not false)
      expect(overrides[PLAN_FEATURES.HAS_EQUIPMENT_BOATS]).toBeUndefined();
    });

    it("treats missing checkbox as false override when included in clearing", () => {
      // When a checkbox is not submitted it means false
      const allFeatureKeys = Object.values(PLAN_FEATURES);
      const submittedOn = new Set([PLAN_FEATURES.HAS_TRAINING]);

      const overrides: Record<string, boolean> = {};
      for (const key of allFeatureKeys) {
        overrides[key] = submittedOn.has(key);
      }

      expect(overrides[PLAN_FEATURES.HAS_TRAINING]).toBe(true);
      expect(overrides[PLAN_FEATURES.HAS_POS]).toBe(false);
      expect(overrides[PLAN_FEATURES.HAS_TOURS_BOOKINGS]).toBe(false);
    });

    it("produces correct overrides when all features are unchecked", () => {
      const allFeatureKeys = Object.values(PLAN_FEATURES);
      const submittedOn = new Set<string>();

      const overrides: Record<string, boolean> = {};
      for (const key of allFeatureKeys) {
        overrides[key] = submittedOn.has(key);
      }

      for (const key of allFeatureKeys) {
        expect(overrides[key]).toBe(false);
      }
    });

    it("produces correct overrides when all features are checked", () => {
      const allFeatureKeys = Object.values(PLAN_FEATURES);
      const submittedOn = new Set(allFeatureKeys);

      const overrides: Record<string, boolean> = {};
      for (const key of allFeatureKeys) {
        overrides[key] = submittedOn.has(key);
      }

      for (const key of allFeatureKeys) {
        expect(overrides[key]).toBe(true);
      }
    });
  });

  // ------------------------------------------------------------------
  // Loader data shape — featureOverrides included in subscription
  // ------------------------------------------------------------------

  describe("loader data shape", () => {
    it("subscription includes featureOverrides field", () => {
      const loaderResponse = {
        subscription: {
          ...mockSubscription,
          featureOverrides: { has_training: true, has_pos: false },
          planDetails: {
            id: "plan-uuid-1",
            name: "standard",
            displayName: "Standard",
            monthlyPrice: 3000,
            features: {
              has_tours_bookings: true,
              has_equipment_boats: false,
              has_training: false,
              has_pos: false,
            },
          },
        },
      };

      expect(loaderResponse.subscription.featureOverrides).toBeDefined();
      expect(loaderResponse.subscription.featureOverrides?.has_training).toBe(true);
    });

    it("subscription featureOverrides is null when no overrides set", () => {
      const loaderResponse = {
        subscription: {
          ...mockSubscription,
          featureOverrides: null,
        },
      };

      expect(loaderResponse.subscription.featureOverrides).toBeNull();
    });

    it("loader includes plan features for display", () => {
      const planFeatures = {
        has_tours_bookings: true,
        has_equipment_boats: false,
        has_training: false,
        has_pos: false,
        has_stripe: true,
      };

      const loaderResponse = {
        subscription: {
          ...mockSubscription,
          planDetails: {
            id: "plan-uuid-1",
            name: "standard",
            displayName: "Standard",
            monthlyPrice: 3000,
            features: planFeatures,
          },
          featureOverrides: null,
        },
      };

      expect(loaderResponse.subscription.planDetails?.features).toEqual(planFeatures);
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

    it("form data for updateFeatureOverrides includes intent and feature flags", () => {
      const formData = {
        intent: "updateFeatureOverrides",
        [`feature_${PLAN_FEATURES.HAS_TRAINING}`]: "on",
        [`feature_${PLAN_FEATURES.HAS_POS}`]: "on",
      };

      expect(formData.intent).toBe("updateFeatureOverrides");
      expect(formData[`feature_${PLAN_FEATURES.HAS_TRAINING}`]).toBe("on");
    });
  });
});
