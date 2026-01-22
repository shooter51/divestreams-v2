/**
 * Admin Plans List Route Tests
 *
 * Tests the subscription plans list page loader and actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/admin/plans";

// Mock modules
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    name: "name",
    displayName: "displayName",
    monthlyPrice: "monthlyPrice",
    yearlyPrice: "yearlyPrice",
    features: "features",
    limits: "limits",
    isActive: "isActive",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  desc: vi.fn((field) => ({ desc: field })),
}));

// Import mocked modules
import { db } from "../../../../lib/db";

describe("Route: admin/plans.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/admin/plans");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Plans - DiveStreams Admin" }]);
    });
  });

  describe("loader", () => {
    const mockPlans = [
      {
        id: "plan-pro",
        name: "pro",
        displayName: "Professional",
        monthlyPrice: 9900,
        yearlyPrice: 95000,
        monthlyPriceId: "price_monthly_pro",
        yearlyPriceId: "price_yearly_pro",
        features: ["Up to 10 users", "Advanced reports"],
        limits: {
          users: 10,
          customers: 500,
          toursPerMonth: -1,
          storageGb: 50,
        },
        isActive: true,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
      },
      {
        id: "plan-starter",
        name: "starter",
        displayName: "Starter",
        monthlyPrice: 4900,
        yearlyPrice: 47000,
        monthlyPriceId: "price_monthly_starter",
        yearlyPriceId: "price_yearly_starter",
        features: ["Up to 3 users", "Basic support"],
        limits: {
          users: 3,
          customers: 100,
          toursPerMonth: 10,
          storageGb: 5,
        },
        isActive: true,
        createdAt: new Date("2024-01-10T10:00:00Z"),
        updatedAt: new Date("2024-01-10T10:00:00Z"),
      },
    ];

    it("should load all plans ordered by monthly price descending", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockPlans),
        }),
      });

      const request = new Request("http://admin.divestreams.com/plans");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.plans).toEqual(mockPlans);
      expect(db.select).toHaveBeenCalled();
    });

    it("should handle empty plans list", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      const request = new Request("http://admin.divestreams.com/plans");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.plans).toEqual([]);
    });

    it("should handle plans with inactive status", async () => {
      // Arrange
      const plansWithInactive = [
        ...mockPlans,
        {
          id: "plan-inactive",
          name: "legacy",
          displayName: "Legacy",
          monthlyPrice: 2900,
          yearlyPrice: 28000,
          monthlyPriceId: null,
          yearlyPriceId: null,
          features: [],
          limits: {
            users: 1,
            customers: 50,
            toursPerMonth: 5,
            storageGb: 1,
          },
          isActive: false,
          createdAt: new Date("2023-12-01T10:00:00Z"),
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(plansWithInactive),
        }),
      });

      const request = new Request("http://admin.divestreams.com/plans");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.plans).toHaveLength(3);
      expect(result.plans[2].isActive).toBe(false);
    });
  });

  describe("action", () => {
    describe("Toggle Active", () => {
      beforeEach(() => {
        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });
      });

      it("should toggle plan from active to inactive", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "toggleActive");
        formData.set("planId", "plan-123");
        formData.set("isActive", "true"); // Currently active

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith({
          isActive: false, // Toggled to false
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });

      it("should toggle plan from inactive to active", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "toggleActive");
        formData.set("planId", "plan-456");
        formData.set("isActive", "false"); // Currently inactive

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith({
          isActive: true, // Toggled to true
          updatedAt: expect.any(Date),
        });
        expect(result).toEqual({ success: true });
      });

      it("should not toggle if planId is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "toggleActive");
        formData.set("isActive", "true");
        // planId missing

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it("should update updatedAt timestamp when toggling", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "toggleActive");
        formData.set("planId", "plan-789");
        formData.set("isActive", "true");

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        await action({ request, params: {}, context: {} });

        // Assert
        const updateCall = (db.update as any).mock.results[0].value;
        const setArg = updateCall.set.mock.calls[0][0];
        expect(setArg.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe("Delete Plan", () => {
      beforeEach(() => {
        (db.delete as any).mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        });
      });

      it("should delete plan with valid planId", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "delete");
        formData.set("planId", "plan-to-delete");

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.delete).toHaveBeenCalled();
        expect(result).toEqual({ success: true, deleted: true });
      });

      it("should not delete if planId is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "delete");
        // planId missing

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.delete).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("Unknown Intent", () => {
      it("should return null for unknown intent", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("intent", "unknown");
        formData.set("planId", "plan-123");

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it("should return null when intent is missing", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("planId", "plan-123");
        // intent missing

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it("should return null with empty formData", async () => {
        // Arrange
        const formData = new FormData();

        const request = new Request("http://admin.divestreams.com/plans", {
          method: "POST",
          body: formData,
        });

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(db.update).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });
});
