/**
 * Embed Tour Listing Route Tests
 *
 * Tests the tour listing page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant._index";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTours: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicTours } from "../../../../lib/db/queries.public";

describe("Route: embed/$tenant._index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return meta title", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Available Tours" }]);
    });
  });

  describe("loader", () => {
    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent");
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "nonexistent" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should return tours when organization found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo");
      const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
      const mockTours = [
        {
          id: "tour-1",
          name: "Reef Dive",
          description: "Explore the coral reef",
          price: "99.00",
          currency: "USD",
          duration: 180,
          maxParticipants: 10,
          type: "single_dive",
          includesEquipment: true,
          includesMeals: false,
          includesTransport: true,
          minCertLevel: "Open Water",
          minAge: 18,
          primaryImage: "https://example.com/reef.jpg",
          thumbnailImage: "https://example.com/reef-thumb.jpg",
        },
        {
          id: "tour-2",
          name: "Wreck Dive",
          description: "Dive the historic shipwreck",
          price: "120.00",
          currency: "USD",
          duration: 240,
          maxParticipants: 8,
          type: "multi_dive",
          includesEquipment: false,
          includesMeals: true,
          includesTransport: false,
          minCertLevel: "Advanced Open Water",
          minAge: 21,
          primaryImage: null,
          thumbnailImage: null,
        },
      ];
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTours as any).mockResolvedValue(mockTours);

      // Act
      const result = await loader({
        request,
        params: { tenant: "demo" },
        context: {},
      });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicTours).toHaveBeenCalledWith("org-123");
      expect(result).toEqual({ tours: mockTours });
    });

    it("should return empty array when no tours available", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/empty");
      const mockOrg = { id: "org-456", name: "Empty Shop", slug: "empty" };
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTours as any).mockResolvedValue([]);

      // Act
      const result = await loader({
        request,
        params: { tenant: "empty" },
        context: {},
      });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("empty");
      expect(getPublicTours).toHaveBeenCalledWith("org-456");
      expect(result).toEqual({ tours: [] });
    });
  });
});
