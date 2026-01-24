import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/equipment/index";

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  equipment: {
    id: "id",
    name: "name",
    brand: "brand",
    model: "model",
    category: "category",
    size: "size",
    condition: "condition",
    status: "status",
    isRentable: "isRentable",
    rentalPrice: "rentalPrice",
    barcode: "barcode",
    organizationId: "organizationId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("tenant/equipment route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20, hasEquipmentRentals: false },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  // Helper to setup db mocks for two queries (filtered list + all for stats)
  const setupDbMocks = (filteredEquipment: unknown[] = [], allEquipment: unknown[] = []) => {
    const mockFilteredQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(filteredEquipment),
    };

    const mockAllQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(allEquipment),
    };

    let selectCallCount = 0;
    (db.select as Mock).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return mockFilteredQuery;
      return mockAllQuery;
    });
  };

  describe("loader", () => {
    it("requires organization context", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches equipment with organization filter", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(result.equipment).toBeDefined();
    });

    it("filters by search when provided", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment?q=regulator");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("regulator");
    });

    it("filters by category when provided", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment?category=bcd");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.category).toBe("bcd");
    });

    it("filters by status when provided", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment?status=available");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.status).toBe("available");
    });

    it("returns formatted equipment data", async () => {
      const mockEquipment = [
        {
          id: "equip-1",
          name: "Pro BCD",
          brand: "ScubaPro",
          model: "Hydros Pro",
          category: "bcd",
          size: "M",
          condition: "excellent",
          status: "available",
          isRentable: true,
          rentalPrice: "25.00",
          barcode: "123456789",
        },
      ];

      setupDbMocks(mockEquipment, mockEquipment);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.equipment).toHaveLength(1);
      expect(result.equipment[0]).toMatchObject({
        id: "equip-1",
        name: "Pro BCD",
        brand: "ScubaPro",
        model: "Hydros Pro",
        category: "bcd",
        size: "M",
        condition: "excellent",
        status: "available",
        isRentable: true,
        rentalPrice: "25.00",
      });
    });

    it("returns empty array when no equipment exists", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.equipment).toEqual([]);
    });

    it("calculates statistics correctly", async () => {
      const mockAllEquipment = [
        { id: "1", status: "available", isRentable: true },
        { id: "2", status: "available", isRentable: false },
        { id: "3", status: "rented", isRentable: true },
        { id: "4", status: "maintenance", isRentable: true },
        { id: "5", status: "retired", isRentable: false },
      ];

      setupDbMocks(mockAllEquipment, mockAllEquipment);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stats).toMatchObject({
        total: 5,
        available: 2,
        rented: 1,
        maintenance: 1,
        retired: 1,
      });
    });

    it("returns freemium data", async () => {
      setupDbMocks([], []);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.hasEquipmentRentals).toBe(false);
      expect(result.isPremium).toBe(false);
    });

    it("counts rentable equipment", async () => {
      const mockAllEquipment = [
        { id: "1", status: "available", isRentable: true },
        { id: "2", status: "available", isRentable: false },
        { id: "3", status: "rented", isRentable: true },
      ];

      setupDbMocks(mockAllEquipment, mockAllEquipment);

      const request = new Request("https://demo.divestreams.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.rentableCount).toBe(2);
    });
  });

  describe("action", () => {
    describe("barcode-lookup intent", () => {
      it("returns error when barcode is not provided", async () => {
        const formData = new FormData();
        formData.append("intent", "barcode-lookup");

        const request = new Request("https://demo.divestreams.com/tenant/equipment", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "No barcode provided" });
      });

      it("returns equipment when barcode is found", async () => {
        const mockEquipment = {
          id: "equip-1",
          name: "Pro BCD",
          barcode: "123456789",
        };

        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockEquipment]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);

        const formData = new FormData();
        formData.append("intent", "barcode-lookup");
        formData.append("barcode", "123456789");

        const request = new Request("https://demo.divestreams.com/tenant/equipment", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          found: true,
          equipmentId: "equip-1",
          equipmentName: "Pro BCD",
        });
      });

      it("returns not found when barcode does not exist", async () => {
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);

        const formData = new FormData();
        formData.append("intent", "barcode-lookup");
        formData.append("barcode", "nonexistent");

        const request = new Request("https://demo.divestreams.com/tenant/equipment", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          found: false,
          error: "No equipment found with barcode: nonexistent",
        });
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/equipment", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toBeNull();
    });
  });
});
