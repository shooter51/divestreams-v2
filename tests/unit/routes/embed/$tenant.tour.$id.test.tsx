/**
 * Embed Tour Detail Route Tests
 *
 * Tests the tour detail page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant.tour.$id";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTourById: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicTourById } from "../../../../lib/db/queries.public";

describe("Route: embed/$tenant.tour.$id.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return title with tour name when tour data is available", () => {
      // Arrange
      const data = {
        tour: {
          id: "tour-123",
          name: "Reef Dive Adventure",
          price: "99.00",
          currency: "USD",
        },
        tenantSlug: "demo",
      };

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Reef Dive Adventure - Book Now" }]);
    });

    it("should return default title when tour data is not available", () => {
      // Arrange
      const data = undefined;

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Tour Details" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockTour = {
      id: "tour-123",
      tourId: "tour-456",
      name: "Reef Dive Adventure",
      description: "Explore the beautiful coral reef",
      price: "99.00",
      currency: "USD",
      type: "multi_dive",
      duration: 180,
      maxParticipants: 12,
      includesEquipment: true,
      includesMeals: false,
      includesTransport: true,
      inclusions: ["Insurance", "Guide"],
      minCertLevel: "Open Water",
      minAge: 12,
      images: [],
      upcomingTrips: [
        {
          id: "trip-789",
          date: "2024-02-15",
          startTime: "09:00",
          endTime: "12:00",
          availableSpots: 5,
          price: "99.00",
          currency: "USD",
        },
      ],
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange & Act & Assert
      try {
        await loader({ request: new Request("http://test.com"), params: { id: "tour-123" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when id parameter is missing", async () => {
      // Arrange & Act & Assert
      try {
        await loader({ request: new Request("http://test.com"), params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({
          request: new Request("http://test.com"),
          params: { tenant: "nonexistent", id: "tour-123" },
          context: {},
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should throw 404 when tour not found", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTourById as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({
          request: new Request("http://test.com"),
          params: { tenant: "demo", id: "nonexistent" },
          context: {},
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getPublicTourById).toHaveBeenCalledWith("org-123", "nonexistent");
    });

    it("should return tour details when all validations pass", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTourById as any).mockResolvedValue(mockTour);

      // Act
      const result = await loader({
        request: new Request("http://test.com"),
        params: { tenant: "demo", id: "tour-123" },
        context: {},
      });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicTourById).toHaveBeenCalledWith("org-123", "tour-123");
      expect(result).toEqual({
        tour: mockTour,
        tenantSlug: "demo",
      });
    });
  });
});
