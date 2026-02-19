import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/tenant/equipment/rentals";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  PLAN_FEATURES: { HAS_EQUIPMENT_BOATS: "has_equipment_boats" },
}));

const mockRentalsData = [
  { rental: { id: "r1", status: "active", rentedAt: "2025-01-01" }, equipment: { name: "BCD" }, customer: { firstName: "John" } },
  { rental: { id: "r2", status: "overdue", rentedAt: "2024-12-01" }, equipment: { name: "Regulator" }, customer: { firstName: "Jane" } },
];

const mockAllRentals = [
  { id: "r1", status: "active" },
  { id: "r2", status: "overdue" },
  { id: "r3", status: "returned" },
  { id: "r4", status: "active" },
];

const mockDbChain = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(() => ({
    db: mockDbChain,
    schema: {
      rentals: { id: "id", status: "status", equipmentId: "equipmentId", customerId: "customerId", organizationId: "organizationId", rentedAt: "rentedAt" },
      equipment: { id: "id", name: "name", organizationId: "organizationId" },
      customers: { id: "id", firstName: "firstName" },
    },
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", conditions: args })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  lte: vi.fn((a, b) => ({ type: "lte", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../../lib/require-feature.server";

describe("tenant/equipment/rentals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires org context", async () => {
      (requireOrgContext as Mock).mockRejectedValue(new Response(null, { status: 302 }));

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/equipment/rentals"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("requires equipment feature", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        user: { id: "user-1" },
        org: { id: "org-1" },
        subscription: { planDetails: { features: {} } },
        isPremium: false,
      });
      (requireFeature as Mock).mockImplementation(() => {
        throw new Response("Feature not available", { status: 403 });
      });

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/equipment/rentals"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 403 }));
    });

    it("returns rentals with stats when feature available", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        user: { id: "user-1" },
        org: { id: "org-1" },
        subscription: { planDetails: { features: { has_equipment_boats: true } } },
        isPremium: true,
      });
      (requireFeature as Mock).mockImplementation(() => {});
      // First query: filtered rentals (chain ends with orderBy)
      // Call order: select, from, leftJoin, leftJoin, where (1st), orderBy
      mockDbChain.where
        .mockReturnValueOnce(mockDbChain) // 1st where call -> chain continues to orderBy
        .mockResolvedValueOnce(mockAllRentals); // 2nd where call -> stats query resolves
      mockDbChain.orderBy.mockResolvedValueOnce(mockRentalsData);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/tenant/equipment/rentals?status=active"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.rentals).toEqual(mockRentalsData);
      expect(result.stats.total).toBe(4);
      expect(result.stats.active).toBe(2);
      expect(result.stats.overdue).toBe(1);
      expect(result.stats.returned).toBe(1);
      expect(result.status).toBe("active");
    });
  });
});
