/**
 * Tenant Boats Index Route Tests
 *
 * Tests the boats list page loader with search and statistics.
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
      name: "Ocean Explorer",
      type: "Dive Boat",
      capacity: 12,
      registrationNumber: "REG-001",
      description: "Large dive boat with full amenities",
      amenities: ["Dive platform", "Sun deck", "Toilet"],
      isActive: true,
    },
    {
      id: "boat-2",
      name: "Sea Breeze",
      type: "Speed Boat",
      capacity: 8,
      registrationNumber: "REG-002",
      description: "Fast boat for quick trips",
      amenities: ["GPS", "Radio"],
      isActive: true,
    },
    {
      id: "boat-3",
      name: "Island Hopper",
      type: "Catamaran",
      capacity: 20,
      registrationNumber: null,
      description: null,
      amenities: null,
      isActive: false,
    },
  ];

  const mockTripCounts = [
    { boatId: "boat-1", count: 5 },
    { boatId: "boat-2", count: 3 },
  ];

  describe("loader", () => {
    it("should load all boats with trip counts and statistics", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const mockSelectBoats = vi.fn();
      const mockSelectTrips = vi.fn();

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockBoats),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockTripCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.activeCount).toBe(2); // Only boat-1 and boat-2
      expect(result.totalCapacity).toBe(20); // 12 + 8 (only active boats)
      expect(result.search).toBe("");
      expect(result.isPremium).toBe(true);

      // Verify boat data with trip counts
      expect(result.boats[0].id).toBe("boat-1");
      expect(result.boats[0].tripCount).toBe(5);
      expect(result.boats[1].tripCount).toBe(3);
      expect(result.boats[2].tripCount).toBe(0); // No trips
    });

    it("should filter boats by search query", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats?q=explorer");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      const filteredBoats = [mockBoats[0]]; // Only Ocean Explorer

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(filteredBoats),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockTripCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toHaveLength(1);
      expect(result.boats[0].name).toBe("Ocean Explorer");
      expect(result.search).toBe("explorer");
      expect(result.total).toBe(1);
    });

    it("should handle null/undefined optional fields with defaults", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const boatWithNulls = [
        {
          id: "boat-1",
          name: "Simple Boat",
          type: null,
          capacity: null,
          registrationNumber: null,
          description: null,
          amenities: null,
          isActive: null,
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(boatWithNulls),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0].type).toBe("Dive Boat"); // Default
      expect(result.boats[0].capacity).toBe(0); // Default
      expect(result.boats[0].registrationNumber).toBe(""); // Default
      expect(result.boats[0].description).toBe(""); // Default
      expect(result.boats[0].amenities).toEqual([]); // Default
      expect(result.boats[0].isActive).toBe(true); // Default
    });

    it("should handle empty boats list", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.totalCapacity).toBe(0);
    });

    it("should calculate statistics correctly with mixed active/inactive boats", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockBoats),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockTripCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      // totalCapacity should only count active boats (boat-1: 12, boat-2: 8)
      expect(result.totalCapacity).toBe(20);
      // activeCount should be 2 (boat-1, boat-2)
      expect(result.activeCount).toBe(2);
      // total should include all boats
      expect(result.total).toBe(3);
    });

    it("should handle non-array amenities", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      const boatsWithInvalidAmenities = [
        {
          id: "boat-1",
          name: "Test Boat",
          type: "Dive Boat",
          capacity: 10,
          registrationNumber: "REG-001",
          description: "Test",
          amenities: "invalid", // Not an array
          isActive: true,
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(boatsWithInvalidAmenities),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0].amenities).toEqual([]);
    });

    it("should handle empty search query", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats?q=");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockBoats),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockTripCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.search).toBe("");
      expect(result.boats).toHaveLength(3);
    });

    it("should map trip counts to correct boats", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/boats");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockBoats),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockTripCounts),
            }),
          }),
        });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.boats[0].id).toBe("boat-1");
      expect(result.boats[0].tripCount).toBe(5);
      expect(result.boats[1].id).toBe("boat-2");
      expect(result.boats[1].tripCount).toBe(3);
      expect(result.boats[2].id).toBe("boat-3");
      expect(result.boats[2].tripCount).toBe(0); // No trips for boat-3
    });
  });
});
