import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/marketing/pricing";

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    isActive: "isActive",
    monthlyPrice: "monthlyPrice",
    yearlyPrice: "yearlyPrice",
    name: "name",
    displayName: "displayName",
    features: "features",
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { db } from "../../../../lib/db";

describe("marketing/pricing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns plans from database sorted by price", async () => {
      const mockPlans = [
        { id: "2", name: "pro", displayName: "Pro", monthlyPrice: 10000, yearlyPrice: 96000, features: ["Feature A"] },
        { id: "1", name: "standard", displayName: "Standard", monthlyPrice: 3000, yearlyPrice: 28800, features: ["Feature B"] },
      ];
      (db.where as Mock).mockResolvedValue(mockPlans);

      const result = await loader({ request: new Request("https://divestreams.com/pricing"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.plans).toHaveLength(2);
      // Should be sorted by price ascending
      expect(result.plans[0].monthlyPrice).toBe(3000);
      expect(result.plans[1].monthlyPrice).toBe(10000);
    });

    it("returns default plans when database returns empty", async () => {
      (db.where as Mock).mockResolvedValue([]);

      const result = await loader({ request: new Request("https://divestreams.com/pricing"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.plans).toHaveLength(2);
      expect(result.plans[0].name).toBe("standard");
      expect(result.plans[1].name).toBe("pro");
    });

    it("returns default plans when database query fails", async () => {
      (db.where as Mock).mockRejectedValue(new Error("DB error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await loader({ request: new Request("https://divestreams.com/pricing"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.plans).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
