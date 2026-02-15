import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/plans";

// Mock dependencies
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    name: "name",
    displayName: "displayName",
    monthlyPrice: "monthlyPrice",
    yearlyPrice: "yearlyPrice",
    isActive: "isActive",
  },
  subscription: {
    planId: "planId",
  },
  tenants: {
    planId: "planId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  count: vi.fn(() => "count"),
}));

// Mock auth - plans routes now require platform context
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}));

import { db } from "../../../../lib/db";

describe("admin/plans route", () => {
  const mockPlans = [
    {
      id: "plan-1",
      name: "free",
      displayName: "Free",
      description: "Basic features",
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: ["Limited customers", "Basic reports"],
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    {
      id: "plan-2",
      name: "professional",
      displayName: "Professional",
      description: "Advanced features",
      monthlyPrice: 4900,
      yearlyPrice: 49000,
      features: ["Unlimited customers", "Advanced reports"],
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    {
      id: "plan-3",
      name: "enterprise",
      displayName: "Enterprise",
      description: "Full features",
      monthlyPrice: 19900,
      yearlyPrice: 199000,
      features: ["Everything in Pro", "Priority support"],
      isActive: false,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (db.orderBy as Mock).mockResolvedValue(mockPlans);
  });

  describe("loader", () => {
    it("fetches all subscription plans", async () => {
      const request = new Request("https://admin.divestreams.com/plans");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.plans).toEqual(mockPlans);
    });

    it("orders plans by monthly price descending", async () => {
      const request = new Request("https://admin.divestreams.com/plans");
      await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(db.orderBy).toHaveBeenCalled();
    });

    it("returns empty array when no plans exist", async () => {
      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://admin.divestreams.com/plans");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.plans).toEqual([]);
    });
  });

  describe("action", () => {
    it("toggles plan active status from active to inactive", async () => {
      (db.where as Mock).mockResolvedValue({ rowCount: 1 });

      const formData = new FormData();
      formData.append("intent", "toggleActive");
      formData.append("planId", "plan-1");
      formData.append("isActive", "true");

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("toggles plan active status from inactive to active", async () => {
      (db.where as Mock).mockResolvedValue({ rowCount: 1 });

      const formData = new FormData();
      formData.append("intent", "toggleActive");
      formData.append("planId", "plan-3");
      formData.append("isActive", "false");

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("deletes a plan", async () => {
      // Mock the count queries to return 0 (no usage)
      // First call: subscription count, Second call: tenants count, Third call: delete
      let callCount = 0;
      (db.where as Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // Return count of 0 for both subscription and tenants queries
          return Promise.resolve([{ count: 0 }]);
        }
        // Return success for delete
        return Promise.resolve({ rowCount: 1 });
      });

      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("planId", "plan-3");

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");
      formData.append("planId", "plan-1");

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result).toBeNull();
    });

    it("returns null when planId is missing for toggleActive", async () => {
      const formData = new FormData();
      formData.append("intent", "toggleActive");
      // Missing planId

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns null when planId is missing for delete", async () => {
      const formData = new FormData();
      formData.append("intent", "delete");
      // Missing planId

      const request = new Request("https://admin.divestreams.com/plans", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
