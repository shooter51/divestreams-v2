import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader, action } from "../../../../../app/routes/tenant/equipment/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock require-feature.server - requireFeature is a no-op in tests
vi.mock("../../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../../lib/plan-features", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    PLAN_FEATURES: { HAS_EQUIPMENT_BOATS: "has_equipment_boats" },
  };
});

describe("app/routes/tenant/equipment/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100, hasEquipmentRentals: true },
      isPremium: false,
    } as any);
  });

  describe("loader", () => {
    it("should fetch all equipment with stats", async () => {
      const mockEquipment = [
        {
          id: "eq-1",
          name: "BCD Pro",
          brand: "Aqualung",
          model: "Pro HD",
          category: "bcd",
          status: "available",
          condition: "excellent",
          isRentable: true,
          rentalPrice: "25.00",
        },
        {
          id: "eq-2",
          name: "Regulator",
          brand: "Scubapro",
          model: "MK25",
          category: "regulator",
          status: "rented",
          condition: "good",
          isRentable: true,
          rentalPrice: "30.00",
        },
      ];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      const request = new Request("http://test.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.equipment).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.available).toBe(1);
      expect(result.stats.rented).toBe(1);
      expect(result.rentableCount).toBe(2);
    });

    it("should filter equipment by search query", async () => {
      const mockEquipment = [
        {
          id: "eq-1",
          name: "BCD Pro",
          brand: "Aqualung",
          model: "Pro HD",
          category: "bcd",
          status: "available",
          condition: "excellent",
          isRentable: false,
        },
      ];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      const request = new Request("http://test.com/tenant/equipment?q=aqualung");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("aqualung");
      expect(result.equipment).toHaveLength(1);
    });

    it("should filter equipment by category", async () => {
      const mockEquipment = [
        {
          id: "eq-1",
          name: "BCD Pro",
          brand: "Aqualung",
          model: "Pro HD",
          category: "bcd",
          status: "available",
          condition: "excellent",
          isRentable: false,
        },
      ];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      const request = new Request("http://test.com/tenant/equipment?category=bcd");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.category).toBe("bcd");
      expect(result.equipment[0].category).toBe("bcd");
    });

    it("should filter equipment by status", async () => {
      const mockEquipment = [
        {
          id: "eq-1",
          name: "BCD Pro",
          brand: "Aqualung",
          model: "Pro HD",
          category: "bcd",
          status: "maintenance",
          condition: "fair",
          isRentable: false,
        },
      ];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      const request = new Request("http://test.com/tenant/equipment?status=maintenance");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe("maintenance");
      expect(result.equipment[0].status).toBe("maintenance");
    });

    it("should calculate stats correctly", async () => {
      const mockEquipment = [
        { id: "eq-1", status: "available", isRentable: true },
        { id: "eq-2", status: "available", isRentable: false },
        { id: "eq-3", status: "rented", isRentable: true },
        { id: "eq-4", status: "maintenance", isRentable: false },
        { id: "eq-5", status: "retired", isRentable: false },
      ];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      const request = new Request("http://test.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.stats.total).toBe(5);
      expect(result.stats.available).toBe(2);
      expect(result.stats.rented).toBe(1);
      expect(result.stats.maintenance).toBe(1);
      expect(result.stats.retired).toBe(1);
      expect(result.rentableCount).toBe(2);
    });

    it("should return freemium rental flags", async () => {
      const mockEquipment: any[] = [];

      // First query: filtered equipment with orderBy
      const mockFilteredBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockEquipment),
      };

      // Second query: all equipment for stats (no orderBy)
      const mockAllBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEquipment),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        return (selectCallCount === 1 ? mockFilteredBuilder : mockAllBuilder) as any;
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Free Org", subdomain: "free" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 10, hasEquipmentRentals: false },
        isPremium: false,
      } as any);

      const request = new Request("http://test.com/tenant/equipment");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.hasEquipmentRentals).toBe(false);
      expect(result.isPremium).toBe(false);
    });
  });

  describe("action", () => {
    it("should find equipment by barcode", async () => {
      const mockEquipment = {
        id: "eq-1",
        name: "BCD Pro",
        barcode: "123456789",
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockEquipment]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const formData = new FormData();
      formData.append("intent", "barcode-lookup");
      formData.append("barcode", "123456789");

      const request = new Request("http://test.com/tenant/equipment", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({
        found: true,
        equipmentId: "eq-1",
        equipmentName: "BCD Pro",
      });
    });

    it("should return error when barcode not found", async () => {
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const formData = new FormData();
      formData.append("intent", "barcode-lookup");
      formData.append("barcode", "999999999");

      const request = new Request("http://test.com/tenant/equipment", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({
        found: false,
        error: "No equipment found with barcode: 999999999",
      });
    });

    it("should return error when no barcode provided", async () => {
      const formData = new FormData();
      formData.append("intent", "barcode-lookup");
      formData.append("barcode", "");

      const request = new Request("http://test.com/tenant/equipment", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({ error: "No barcode provided" });
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/equipment", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toBeNull();
    });
  });
});
