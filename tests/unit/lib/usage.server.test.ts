import { describe, it, expect } from "vitest";
import { checkLimit, checkAllLimits, type UsageStats, type LimitCheck } from "../../../lib/usage.server";
import type { PlanLimits } from "../../../lib/plan-features";

describe("usage.server", () => {
  describe("checkLimit", () => {
    it("should return allowed=true when under limit", () => {
      const result = checkLimit(50, 100);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(50);
      expect(result.percent).toBe(50);
    });

    it("should return allowed=false when at limit", () => {
      const result = checkLimit(100, 100);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.percent).toBe(100);
    });

    it("should return allowed=false when over limit", () => {
      const result = checkLimit(150, 100);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(150);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.percent).toBe(150);
    });

    it("should handle unlimited limit (-1)", () => {
      const result = checkLimit(9999, -1);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(false);
      expect(result.percent).toBe(0);
      expect(result.current).toBe(9999);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it("should return warning=true when approaching limit (>= 80%)", () => {
      const result = checkLimit(80, 100);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(true);
      expect(result.percent).toBe(80);
    });

    it("should return warning=false when well under limit (< 80%)", () => {
      const result = checkLimit(70, 100);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(false);
      expect(result.percent).toBe(70);
    });

    it("should return warning=false when over limit", () => {
      const result = checkLimit(120, 100);

      expect(result.allowed).toBe(false);
      expect(result.warning).toBe(false);
    });

    it("should handle zero current usage", () => {
      const result = checkLimit(0, 100);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(false);
      expect(result.percent).toBe(0);
      expect(result.remaining).toBe(100);
    });

    it("should handle zero limit (always over)", () => {
      const result = checkLimit(1, 0);

      expect(result.allowed).toBe(false);
      expect(result.percent).toBe(Infinity);
    });

    it("should round percentage correctly", () => {
      const result = checkLimit(33, 100);
      expect(result.percent).toBe(33);

      const result2 = checkLimit(67, 100);
      expect(result2.percent).toBe(67);

      const result3 = checkLimit(1, 3);
      expect(result3.percent).toBe(33); // rounds 33.33...
    });

    it("should handle exactly at warning threshold (80%)", () => {
      const result = checkLimit(80, 100);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(true);
    });

    it("should handle just below warning threshold (79%)", () => {
      const result = checkLimit(79, 100);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe(false);
    });

    it("should not have negative remaining", () => {
      const result = checkLimit(150, 100);

      expect(result.remaining).toBe(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkAllLimits", () => {
    it("should check all limit types", () => {
      const usage: UsageStats = {
        users: 5,
        customers: 50,
        toursPerMonth: 20,
        storageGb: 2,
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.allowed).toBe(true);
      expect(results.users.current).toBe(5);
      expect(results.users.limit).toBe(10);

      expect(results.customers.allowed).toBe(true);
      expect(results.customers.current).toBe(50);
      expect(results.customers.limit).toBe(100);

      expect(results.toursPerMonth.allowed).toBe(true);
      expect(results.toursPerMonth.current).toBe(20);
      expect(results.toursPerMonth.limit).toBe(50);

      expect(results.storageGb.allowed).toBe(true);
      expect(results.storageGb.current).toBe(2);
      expect(results.storageGb.limit).toBe(10);
    });

    it("should handle mixed allowed/not allowed states", () => {
      const usage: UsageStats = {
        users: 8,
        customers: 100, // at limit
        toursPerMonth: 60, // over limit
        storageGb: 5,
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.allowed).toBe(true);
      expect(results.customers.allowed).toBe(false); // at limit
      expect(results.toursPerMonth.allowed).toBe(false); // over limit
      expect(results.storageGb.allowed).toBe(true);
    });

    it("should handle unlimited limits (-1)", () => {
      const usage: UsageStats = {
        users: 999,
        customers: 999,
        toursPerMonth: 999,
        storageGb: 999,
      };

      const limits: PlanLimits = {
        users: -1,
        customers: -1,
        toursPerMonth: -1,
        storageGb: -1,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.allowed).toBe(true);
      expect(results.users.remaining).toBe(-1);
      expect(results.customers.allowed).toBe(true);
      expect(results.customers.remaining).toBe(-1);
      expect(results.toursPerMonth.allowed).toBe(true);
      expect(results.toursPerMonth.remaining).toBe(-1);
      expect(results.storageGb.allowed).toBe(true);
      expect(results.storageGb.remaining).toBe(-1);
    });

    it("should handle warnings for all limits", () => {
      const usage: UsageStats = {
        users: 8, // 80% of 10
        customers: 85, // 85% of 100
        toursPerMonth: 40, // 80% of 50
        storageGb: 9, // 90% of 10
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.warning).toBe(true);
      expect(results.customers.warning).toBe(true);
      expect(results.toursPerMonth.warning).toBe(true);
      expect(results.storageGb.warning).toBe(true);
    });

    it("should handle zero usage", () => {
      const usage: UsageStats = {
        users: 0,
        customers: 0,
        toursPerMonth: 0,
        storageGb: 0,
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.percent).toBe(0);
      expect(results.users.remaining).toBe(10);
      expect(results.customers.percent).toBe(0);
      expect(results.customers.remaining).toBe(100);
      expect(results.toursPerMonth.percent).toBe(0);
      expect(results.toursPerMonth.remaining).toBe(50);
      expect(results.storageGb.percent).toBe(0);
      expect(results.storageGb.remaining).toBe(10);
    });

    it("should return object with all required properties", () => {
      const usage: UsageStats = {
        users: 5,
        customers: 50,
        toursPerMonth: 20,
        storageGb: 2,
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      // Verify all limit types are present
      expect(results).toHaveProperty("users");
      expect(results).toHaveProperty("customers");
      expect(results).toHaveProperty("toursPerMonth");
      expect(results).toHaveProperty("storageGb");

      // Verify each has all required LimitCheck properties
      const limitCheck: LimitCheck = results.users;
      expect(limitCheck).toHaveProperty("allowed");
      expect(limitCheck).toHaveProperty("warning");
      expect(limitCheck).toHaveProperty("percent");
      expect(limitCheck).toHaveProperty("current");
      expect(limitCheck).toHaveProperty("limit");
      expect(limitCheck).toHaveProperty("remaining");
    });

    it("should handle different warning states per limit", () => {
      const usage: UsageStats = {
        users: 5,  // 50% - no warning
        customers: 85, // 85% - warning
        toursPerMonth: 10, // 20% - no warning
        storageGb: 8, // 80% - warning
      };

      const limits: PlanLimits = {
        users: 10,
        customers: 100,
        toursPerMonth: 50,
        storageGb: 10,
      };

      const results = checkAllLimits(usage, limits);

      expect(results.users.warning).toBe(false);
      expect(results.customers.warning).toBe(true);
      expect(results.toursPerMonth.warning).toBe(false);
      expect(results.storageGb.warning).toBe(true);
    });
  });
});
