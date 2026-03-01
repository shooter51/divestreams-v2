import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  equipment: {
    id: "id",
    organizationId: "organizationId",
    category: "category",
    name: "name",
    brand: "brand",
    model: "model",
    size: "size",
    rentalPrice: "rentalPrice",
    isRentable: "isRentable",
    isPublic: "isPublic",
    status: "status",
    condition: "condition",
  },
  images: {
    id: "id",
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
    isPrimary: "isPrimary",
    url: "url",
  },
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  or: vi.fn((...conditions: unknown[]) => ({ type: "or", conditions })),
  like: vi.fn((a, b) => ({ type: "like", field: a, value: b })),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
  asc: vi.fn((col) => ({ type: "asc", col })),
  desc: vi.fn((col) => ({ type: "desc", col })),
}));

import { db } from "../../../../../lib/db";
import { eq, like } from "drizzle-orm";
import { loader } from "../../../../../app/routes/site/equipment/index";

describe("site/equipment/index route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };

  const mockEquipmentItem = {
    id: "eq-1",
    category: "bcd",
    name: "Aqualung Pro HD",
    brand: "Aqualung",
    model: "Pro HD",
    size: "L",
    rentalPrice: "25.00",
    isRentable: true,
    status: "available",
    condition: "excellent",
  };

  const mockEquipmentItem2 = {
    id: "eq-2",
    category: "regulator",
    name: "Mares Abyss 22",
    brand: "Mares",
    model: "Abyss 22",
    size: null,
    rentalPrice: "15.00",
    isRentable: true,
    status: "available",
    condition: "good",
  };

  /**
   * Sets up db mocks for the loader's sequential queries:
   * 1. Org lookup: ...where().limit(1) -> terminal at limit
   * 2. Equipment data: ...where().orderBy().limit().offset() -> terminal at offset
   * 3. Count query: ...from().where() -> terminal at where (resolves as promise)
   * 4. Category counts: ...where().groupBy() -> terminal at groupBy
   * 5. Per-item image queries: ...where().limit(1) -> terminal at limit
   */
  function setupMocks({
    org = mockOrg as typeof mockOrg | null,
    equipmentData = [] as typeof mockEquipmentItem[],
    countResult = [{ count: 0 }],
    categoryCounts = [] as { category: string; count: number }[],
    imageUrl = null as string | null,
  } = {}) {
    // Reset all methods to be chainable (return db)
    (db.select as Mock).mockReturnValue(db);
    (db.from as Mock).mockReturnValue(db);
    (db.orderBy as Mock).mockReturnValue(db);

    // limit() is called for:
    //   call 1: org lookup -> resolve with org (terminal)
    //   call 2: equipment data chain -> return db (chains to offset)
    //   call 3+: per-item image queries -> resolve with image (terminal)
    let limitCallCount = 0;
    (db.limit as Mock).mockImplementation(() => {
      limitCallCount++;
      if (limitCallCount === 1) {
        return Promise.resolve(org ? [org] : []);
      }
      if (limitCallCount === 2) {
        // Equipment data chain: limit chains to offset
        return db;
      }
      // Image queries for each equipment item
      return Promise.resolve(imageUrl ? [{ url: imageUrl }] : []);
    });

    // offset() is terminal for equipment data query
    (db.offset as Mock).mockResolvedValue(equipmentData);

    // where() is called for:
    //   call 1: org lookup -> chain (to limit)
    //   call 2: equipment data -> chain (to orderBy)
    //   call 3: count query -> resolve directly (terminal)
    //   call 4: category counts -> chain (to groupBy)
    //   call 5+: image queries -> chain (to limit)
    let whereCallCount = 0;
    (db.where as Mock).mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 3) {
        return Promise.resolve(countResult);
      }
      return db;
    });

    // groupBy() is terminal for category counts
    (db.groupBy as Mock).mockResolvedValue(categoryCounts);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when organization is not found", async () => {
      setupMocks({ org: null });

      const request = new Request("https://unknown.divestreams.com/site/equipment");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns empty equipment list when none found", async () => {
      setupMocks({
        equipmentData: [],
        countResult: [{ count: 0 }],
        categoryCounts: [],
      });

      const request = new Request("https://demo.divestreams.com/site/equipment");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.equipment).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.organizationName).toBe("Demo Dive Shop");
    });

    it("returns equipment with pagination data", async () => {
      setupMocks({
        equipmentData: [mockEquipmentItem, mockEquipmentItem2],
        countResult: [{ count: 25 }],
        categoryCounts: [
          { category: "bcd", count: 10 },
          { category: "regulator", count: 15 },
        ],
        imageUrl: "https://cdn.example.com/bcd.jpg",
      });

      const request = new Request("https://demo.divestreams.com/site/equipment?page=2");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.equipment).toHaveLength(2);
      expect(result.equipment[0].id).toBe("eq-1");
      expect(result.equipment[0].name).toBe("Aqualung Pro HD");
      expect(result.equipment[0].primaryImage).toBe("https://cdn.example.com/bcd.jpg");
      expect(result.equipment[1].id).toBe("eq-2");
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3); // ceil(25/12)
      expect(result.organizationName).toBe("Demo Dive Shop");
    });

    it("applies category filter from query params", async () => {
      setupMocks({
        equipmentData: [mockEquipmentItem],
        countResult: [{ count: 1 }],
        categoryCounts: [{ category: "bcd", count: 1 }],
      });

      const request = new Request("https://demo.divestreams.com/site/equipment?category=bcd");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.category).toBe("bcd");
      expect(result.equipment).toHaveLength(1);
      expect(eq).toHaveBeenCalledWith("category", "bcd");
    });

    it("applies search filter from query params", async () => {
      setupMocks({
        equipmentData: [mockEquipmentItem2],
        countResult: [{ count: 1 }],
        categoryCounts: [{ category: "regulator", count: 1 }],
      });

      const request = new Request("https://demo.divestreams.com/site/equipment?search=mares");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.search).toBe("mares");
      expect(result.equipment).toHaveLength(1);
      expect(like).toHaveBeenCalledWith("name", "%mares%");
    });

    it("returns category counts", async () => {
      const categoryCounts = [
        { category: "bcd", count: 5 },
        { category: "regulator", count: 8 },
        { category: "wetsuit", count: 3 },
      ];
      setupMocks({
        equipmentData: [],
        countResult: [{ count: 0 }],
        categoryCounts,
      });

      const request = new Request("https://demo.divestreams.com/site/equipment");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.categoryCounts).toBeInstanceOf(Map);
      expect(result.categoryCounts.get("bcd")).toBe(5);
      expect(result.categoryCounts.get("regulator")).toBe(8);
      expect(result.categoryCounts.get("wetsuit")).toBe(3);
    });

    it("defaults to page 1 and sort by name", async () => {
      setupMocks({
        equipmentData: [],
        countResult: [{ count: 0 }],
        categoryCounts: [],
      });

      const request = new Request("https://demo.divestreams.com/site/equipment");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.page).toBe(1);
      expect(result.sortBy).toBe("name");
      expect(result.category).toBeNull();
      expect(result.search).toBeNull();
    });

    it("parses sort parameter for price-low", async () => {
      setupMocks({
        equipmentData: [],
        countResult: [{ count: 0 }],
        categoryCounts: [],
      });

      const request = new Request("https://demo.divestreams.com/site/equipment?sort=price-low");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.sortBy).toBe("price-low");
    });
  });
});
