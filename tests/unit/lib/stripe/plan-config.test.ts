/**
 * Plan Config Tests
 *
 * Tests for the centralized subscription plan configuration.
 */

import { describe, it, expect } from "vitest";
import { getAllPlanConfigs, PLAN_CONFIGS } from "../../../../lib/stripe/plan-config";

describe("Plan Config", () => {
  describe("getAllPlanConfigs", () => {
    it("returns 4 plans", () => {
      const plans = getAllPlanConfigs();
      expect(plans).toHaveLength(4);
    });

    it("includes free, starter, pro, and enterprise plans", () => {
      const planNames = getAllPlanConfigs().map((p) => p.name);
      expect(planNames).toContain("free");
      expect(planNames).toContain("starter");
      expect(planNames).toContain("pro");
      expect(planNames).toContain("enterprise");
    });
  });

  describe("planFeatures", () => {
    it("each plan has planFeatures with boolean values", () => {
      const plans = getAllPlanConfigs();
      for (const plan of plans) {
        expect(plan.planFeatures).toBeDefined();
        const values = Object.values(plan.planFeatures);
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) {
          expect(typeof value).toBe("boolean");
        }
      }
    });

    it("enterprise plan has all features enabled", () => {
      const enterprise = PLAN_CONFIGS.enterprise;
      const featureValues = Object.values(enterprise.planFeatures);
      expect(featureValues.length).toBeGreaterThan(0);
      for (const value of featureValues) {
        expect(value).toBe(true);
      }
    });

    it("free plan has limited features", () => {
      const free = PLAN_CONFIGS.free;
      const featureValues = Object.values(free.planFeatures);
      const enabledCount = featureValues.filter((v) => v === true).length;
      const disabledCount = featureValues.filter((v) => v === false).length;

      // Free plan should have some features enabled and some disabled
      expect(enabledCount).toBeGreaterThan(0);
      expect(disabledCount).toBeGreaterThan(0);
      // Free plan should have more disabled than enabled features
      expect(disabledCount).toBeGreaterThan(enabledCount);
    });
  });
});
