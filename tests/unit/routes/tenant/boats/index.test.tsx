/**
 * Tenant Boats Index Route Tests
 *
 * Tests the boats list page loader with search, trip counts, and statistics.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/boats/index";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked modules
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

describe("Route: tenant/boats/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBoats = [
    {
      id: "boat-1",
      name: "Sea Explorer",
      type: "Dive Boat",
      capacity: 20,
      registrationNumber: "REG-001",
      description: "A beautiful dive boat",
      amenities: ["GPS", "Radio", "Dive platform"],
      isActive: true,
    },
    {
      id: "boat-2",
      name: "Ocean Runner",
      type: "Speed Boat",
      capacity: 15,
      registrationNumber: "REG-002",
      description: "Fast speed boat",
      amenities: ["GPS"],
      isActive: true,
    },
    {
      id: "boat-3",
      name: "Wave Rider",
      type: "Catamaran",
      capacity: 30,
      registrationNumber: "REG-003",
      description: "Large catamaran",
      amenities: [],
      isActive: false,
    },
  ];

  const mockTripCounts = [
    { boatId: "boat-1", count: 10 },
    { boatId: "boat-2", count: 5 },
  ];

  describe("loader", () => {
    it("should load boats list without search", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          // First call: boats query
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(mockBoats);
        } else if (selectCallCount === 2) {
          // Second call: trip counts query
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue(mockTripCounts);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toHaveLength(3);
      expect(result.boats[0]).toEqual({
        id: "boat-1",
        name: "Sea Explorer",
        type: "Dive Boat",
        capacity: 20,
        registrationNumber: "REG-001",
        description: "A beautiful dive boat",
        amenities: ["GPS", "Radio", "Dive platform"],
        isActive: true,
        tripCount: 10,
      });
      expect(result.boats[1].tripCount).toBe(5);
      expect(result.boats[2].tripCount).toBe(0); // No trips

      expect(result.total).toBe(3);
      expect(result.activeCount).toBe(2);
      expect(result.totalCapacity).toBe(35); // 20 + 15 (only active boats)
      expect(result.search).toBe("");
      expect(result.isPremium).toBe(false);
    });

    it("should load boats list with search query", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats?q=Explorer");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const filteredBoats = [mockBoats[0]]; // Only Sea Explorer

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          // First call: boats query with search
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(filteredBoats);
        } else if (selectCallCount === 2) {
          // Second call: trip counts query
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue(mockTripCounts);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toHaveLength(1);
      expect(result.boats[0].name).toBe("Sea Explorer");
      expect(result.search).toBe("Explorer");
      expect(result.isPremium).toBe(true);
    });

    it("should handle empty boats list", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue([]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.totalCapacity).toBe(0);
    });

    it("should handle null/default values", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      const boatsWithNulls = [
        {
          id: "boat-1",
          name: "Test Boat",
          type: null,
          capacity: null,
          registrationNumber: null,
          description: null,
          amenities: null,
          isActive: null,
        },
      ];

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(boatsWithNulls);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue([]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0]).toEqual({
        id: "boat-1",
        name: "Test Boat",
        type: "Dive Boat",
        capacity: 0,
        registrationNumber: "",
        description: "",
        amenities: [],
        isActive: true,
        tripCount: 0,
      });
    });

    it("should calculate statistics correctly", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(mockBoats);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue(mockTripCounts);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      // Total boats: 3
      expect(result.total).toBe(3);

      // Active boats: 2 (boat-1 and boat-2)
      expect(result.activeCount).toBe(2);

      // Total capacity: 35 (20 + 15, only active boats)
      expect(result.totalCapacity).toBe(35);
    });

    it("should map trip counts to boats correctly", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(mockBoats);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue(mockTripCounts);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0].tripCount).toBe(10);
      expect(result.boats[1].tripCount).toBe(5);
      expect(result.boats[2].tripCount).toBe(0); // No trip count for this boat
    });

    it("should handle non-array amenities field", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      const boatsWithStringAmenities = [
        {
          ...mockBoats[0],
          amenities: "GPS, Radio" as any, // Invalid: string instead of array
        },
      ];

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockGroupBy = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue(boatsWithStringAmenities);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockReturnValue({ groupBy: mockGroupBy });
          mockGroupBy.mockResolvedValue([]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0].amenities).toEqual([]);
    });
  });
});
