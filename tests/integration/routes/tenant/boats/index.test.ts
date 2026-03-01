import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/boats/index";
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

describe("app/routes/tenant/boats/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      user: { id: "user-123", email: "test@example.com" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as unknown);
  });

  describe("loader", () => {
    it("should fetch all boats with trip counts", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Sea Explorer",
          capacity: 12,
          crewSize: 3,
          type: "liveaboard",
          description: "Luxury dive boat",
          manufacturer: "Custom",
          model: "Explorer 2020",
          yearBuilt: 2020,
          length: "25",
          beam: "6",
          draft: "2",
          hullMaterial: "Fiberglass",
          engineType: "Diesel",
          fuelCapacity: "500",
          waterCapacity: "300",
          amenities: ["WiFi", "AC", "Kitchen"],
          homePort: "Port Douglas",
          registrationNumber: "REG123",
          insuranceExpiry: new Date("2025-12-31"),
          lastMaintenance: new Date("2024-06-01"),
          nextMaintenance: new Date("2024-12-01"),
          isActive: true,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
        {
          id: "boat-2",
          name: "Reef Runner",
          capacity: 8,
          crewSize: 2,
          type: "day-boat",
          description: "Fast day boat",
          manufacturer: null,
          model: null,
          yearBuilt: null,
          length: null,
          beam: null,
          draft: null,
          hullMaterial: null,
          engineType: null,
          fuelCapacity: null,
          waterCapacity: null,
          amenities: [],
          homePort: null,
          registrationNumber: null,
          insuranceExpiry: null,
          lastMaintenance: null,
          nextMaintenance: null,
          isActive: true,
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
        },
      ];

      const mockTripCounts = [
        { boatId: "boat-1", count: 15 },
        { boatId: "boat-2", count: 8 },
      ];

      // First query: boats
      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      // Second query: trip counts
      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      // Third query: images
      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      const request = new Request("http://test.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.boats).toHaveLength(2);
      expect(result.boats[0].name).toBe("Sea Explorer");
      expect(result.boats[0].tripCount).toBe(15);
      expect(result.boats[1].name).toBe("Reef Runner");
      expect(result.boats[1].tripCount).toBe(8);
      expect(result.totalCapacity).toBe(20);
      expect(result.activeCount).toBe(2);
    });

    it("should filter boats by search query", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Sea Explorer",
          capacity: 12,
          type: "liveaboard",
          isActive: true,
        },
      ];

      const mockTripCounts: unknown[] = [];

      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      const request = new Request("http://test.com/tenant/boats?q=explorer");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("explorer");
      expect(result.boats).toHaveLength(1);
      expect(result.boats[0].name).toBe("Sea Explorer");
    });

    it("should handle boats with no trips", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "New Boat",
          capacity: 10,
          type: "day-boat",
          isActive: true,
        },
      ];

      const mockTripCounts: unknown[] = [];

      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      const request = new Request("http://test.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.boats[0].tripCount).toBe(0);
    });

    it("should transform raw boats to UI format with defaults", async () => {
      const mockBoats = [
        {
          id: "boat-1",
          name: "Minimal Boat",
          capacity: 5,
          crewSize: null,
          type: null,
          description: null,
          manufacturer: null,
          model: null,
          yearBuilt: null,
          length: null,
          beam: null,
          draft: null,
          hullMaterial: null,
          engineType: null,
          fuelCapacity: null,
          waterCapacity: null,
          amenities: null,
          homePort: null,
          registrationNumber: null,
          insuranceExpiry: null,
          lastMaintenance: null,
          nextMaintenance: null,
          isActive: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      const mockTripCounts: unknown[] = [];

      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      const request = new Request("http://test.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.boats[0].type).toBe("Dive Boat");
      expect(result.boats[0].description).toBe("");
      expect(result.boats[0].amenities).toEqual([]);
      expect(result.boats[0].isActive).toBe(true);
    });

    it("should calculate total capacity correctly", async () => {
      const mockBoats = [
        { id: "boat-1", capacity: 12, isActive: true },
        { id: "boat-2", capacity: 8, isActive: true },
        { id: "boat-3", capacity: 6, isActive: false },
      ];

      const mockTripCounts: unknown[] = [];

      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      const request = new Request("http://test.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.totalCapacity).toBe(20);
      expect(result.activeCount).toBe(2);
    });

    it("should return isPremium flag", async () => {
      const mockBoats: unknown[] = [];
      const mockTripCounts: unknown[] = [];

      const mockBoatsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockBoats),
      };

      const mockTripCountsBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockTripCounts),
      };

      const mockImagesBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockBoatsBuilder as unknown;
        if (selectCallCount === 2) return mockTripCountsBuilder as unknown;
        return mockImagesBuilder as unknown;
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Premium Org", subdomain: "premium" },
        user: { id: "user-123", email: "test@example.com" },
        canAddCustomer: true,
        usage: { customers: 0 },
        limits: { customers: 1000 },
        isPremium: true,
      } as unknown);

      const request = new Request("http://test.com/tenant/boats");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.isPremium).toBe(true);
    });
  });
});
