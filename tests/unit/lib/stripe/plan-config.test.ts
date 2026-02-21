/**
 * Plan Config Tests
 *
 * Tests for the centralized subscription plan configuration.
 */

import { describe, it, expect } from "vitest";
import { getAllPlanConfigs, PLAN_CONFIGS } from "../../../../lib/stripe/plan-config";

describe("Plan Config", () => {
  describe("getAllPlanConfigs", () => {
    it("returns 2 plans", () => {
      const plans = getAllPlanConfigs();
      expect(plans).toHaveLength(2);
    });

    it("includes standard and pro plans", () => {
      const planNames = getAllPlanConfigs().map((p) => p.name);
      expect(planNames).toContain("standard");
      expect(planNames).toContain("pro");
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

    it("pro plan has all features enabled", () => {
      const pro = PLAN_CONFIGS.pro;
      const featureValues = Object.values(pro.planFeatures);
      expect(featureValues.length).toBeGreaterThan(0);
      for (const value of featureValues) {
        expect(value).toBe(true);
      }
    });

    it("standard plan has limited features", () => {
      const standard = PLAN_CONFIGS.standard;
      const featureValues = Object.values(standard.planFeatures);
      const enabledCount = featureValues.filter((v) => v === true).length;
      const disabledCount = featureValues.filter((v) => v === false).length;

      // Standard plan should have some features enabled and some disabled
      expect(enabledCount).toBeGreaterThan(0);
      expect(disabledCount).toBeGreaterThan(0);
      // Standard plan should have more disabled than enabled features
      expect(disabledCount).toBeGreaterThan(enabledCount);
    });
  });
});
