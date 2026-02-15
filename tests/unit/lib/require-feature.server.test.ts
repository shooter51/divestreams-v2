import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireFeature, requireLimit } from "../../../lib/require-feature.server";
import type { PlanFeaturesObject, PlanLimits } from "../../../lib/plan-features";
import * as usageModule from "../../../lib/usage.server";

vi.mock("../../../lib/usage.server");

describe("require-feature.server", () => {
  describe("requireFeature", () => {
    it("should not throw when feature is enabled", () => {
      const features: PlanFeaturesObject = {
        customBranding: true,
        apiAccess: false,
        advancedReporting: false,
        multiUser: true,
        priority_support: false,
        customDomain: false,
        whiteLabel: false,
        bulkImport: false,
        advancedPermissions: false,
        sso: false,
      };

      expect(() => requireFeature(features, "customBranding")).not.toThrow();
      expect(() => requireFeature(features, "multiUser")).not.toThrow();
    });

    it("should throw redirect when feature is disabled", () => {
      const features: PlanFeaturesObject = {
        customBranding: false,
        apiAccess: false,
        advancedReporting: false,
        multiUser: false,
        priority_support: false,
        customDomain: false,
        whiteLabel: false,
        bulkImport: false,
        advancedPermissions: false,
        sso: false,
      };

      expect(() => requireFeature(features, "customBranding")).toThrow();
      expect(() => requireFeature(features, "apiAccess")).toThrow();
    });

    it("should include feature name in redirect URL", () => {
      const features: PlanFeaturesObject = {
        customBranding: false,
        apiAccess: false,
        advancedReporting: false,
        multiUser: false,
        priority_support: false,
        customDomain: false,
        whiteLabel: false,
        bulkImport: false,
        advancedPermissions: false,
        sso: false,
      };

      try {
        requireFeature(features, "customBranding");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toContain("upgrade=customBranding");
      }
    });

    it("should handle different feature types", () => {
      const features: PlanFeaturesObject = {
        customBranding: true,
        apiAccess: false,
        advancedReporting: true,
        multiUser: false,
        priority_support: true,
        customDomain: false,
        whiteLabel: false,
        bulkImport: true,
        advancedPermissions: false,
        sso: false,
      };

      expect(() => requireFeature(features, "customBranding")).not.toThrow();
      expect(() => requireFeature(features, "advancedReporting")).not.toThrow();
      expect(() => requireFeature(features, "priority_support")).not.toThrow();
      expect(() => requireFeature(features, "bulkImport")).not.toThrow();

      expect(() => requireFeature(features, "apiAccess")).toThrow();
      expect(() => requireFeature(features, "multiUser")).toThrow();
    });
  });

  describe("requireLimit", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return usage stats when under limit", async () => {
      const mockUsage = {
        customers: 5,
        tours: 3,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      const result = await requireLimit("org-123", "customers", limits);

      expect(result).toEqual({
        current: 5,
        limit: 100,
        remaining: 95,
      });
    });

    it("should throw redirect when at limit", async () => {
      const mockUsage = {
        customers: 100,
        tours: 3,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      await expect(requireLimit("org-123", "customers", limits)).rejects.toThrow();

      try {
        await requireLimit("org-123", "customers", limits);
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toContain("limit_exceeded=customers");
      }
    });

    it("should throw redirect when over limit", async () => {
      const mockUsage = {
        customers: 150,
        tours: 3,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      await expect(requireLimit("org-123", "customers", limits)).rejects.toThrow();
    });

    it("should handle unlimited (-1) limits", async () => {
      const mockUsage = {
        customers: 999,
        tours: 3,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: -1,  // Unlimited
        tours: 50,
        bookings: 200,
        users: 10,
      };

      const result = await requireLimit("org-123", "customers", limits);

      expect(result).toEqual({
        current: 999,
        limit: -1,
        remaining: -1,
      });
    });

    it("should handle different limit types", async () => {
      const mockUsage = {
        customers: 5,
        tours: 10,
        bookings: 20,
        users: 3,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      const toursResult = await requireLimit("org-123", "tours", limits);
      expect(toursResult).toEqual({
        current: 10,
        limit: 50,
        remaining: 40,
      });

      const bookingsResult = await requireLimit("org-123", "bookings", limits);
      expect(bookingsResult).toEqual({
        current: 20,
        limit: 200,
        remaining: 180,
      });
    });

    it("should handle zero current usage", async () => {
      const mockUsage = {
        customers: 0,
        tours: 0,
        bookings: 0,
        users: 0,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      const result = await requireLimit("org-123", "customers", limits);

      expect(result).toEqual({
        current: 0,
        limit: 100,
        remaining: 100,
      });
    });

    it("should handle missing usage stats (defaults to 0)", async () => {
      const mockUsage = {
        // customers missing
        tours: 5,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage as any);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      const result = await requireLimit("org-123", "customers", limits);

      expect(result.current).toBe(0);
    });

    it("should pass organization ID to getUsage", async () => {
      const mockUsage = {
        customers: 5,
        tours: 3,
        bookings: 10,
        users: 2,
      };

      vi.mocked(usageModule.getUsage).mockResolvedValue(mockUsage);

      const limits: PlanLimits = {
        customers: 100,
        tours: 50,
        bookings: 200,
        users: 10,
      };

      await requireLimit("org-456", "customers", limits);

      expect(usageModule.getUsage).toHaveBeenCalledWith("org-456");
    });
  });
});
