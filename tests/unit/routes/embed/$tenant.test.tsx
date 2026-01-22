/**
 * Embed Tenant Layout Route Tests
 *
 * Tests the booking widget layout for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug } from "../../../../lib/db/queries.public";

describe("Route: embed/$tenant.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return title with organization name when organization data is available", () => {
      // Arrange
      const data = {
        organization: {
          id: "org-123",
          name: "Demo Dive Shop",
          slug: "demo",
          currency: "USD",
          timezone: "UTC",
        },
        branding: {
          primaryColor: "#0066cc",
          secondaryColor: "#f0f9ff",
          logo: undefined,
        },
      };

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Book with Demo Dive Shop" }]);
    });

    it("should return default title when organization data is not available", () => {
      // Arrange
      const data = undefined;

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Book Now" }]);
    });
  });

  describe("loader", () => {
    const mockOrgWithoutMetadata = {
      id: "org-123",
      name: "Demo Dive Shop",
      slug: "demo",
      metadata: null,
    };

    const mockOrgWithMetadata = {
      id: "org-456",
      name: "Pro Dive Shop",
      slug: "pro",
      metadata: {
        settings: {
          branding: {
            primaryColor: "#ff6600",
            secondaryColor: "#fff4e6",
            logo: "https://example.com/logo.png",
          },
          currency: "EUR",
          timezone: "Europe/Paris",
        },
      },
    };

    const mockOrgWithPartialBranding = {
      id: "org-789",
      name: "Partial Dive Shop",
      slug: "partial",
      metadata: {
        settings: {
          branding: {
            primaryColor: "#00cc66",
          },
          currency: "GBP",
        },
      },
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
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
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should return organization and branding with defaults when org found with no metadata", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrgWithoutMetadata);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(result).toEqual({
        organization: {
          id: "org-123",
          name: "Demo Dive Shop",
          slug: "demo",
          currency: "USD",
          timezone: "UTC",
        },
        branding: {
          primaryColor: "#0066cc",
          secondaryColor: "#f0f9ff",
          logo: undefined,
        },
      });
    });

    it("should return organization and branding with custom settings when org found with metadata", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/pro");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrgWithMetadata);

      // Act
      const result = await loader({ request, params: { tenant: "pro" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("pro");
      expect(result).toEqual({
        organization: {
          id: "org-456",
          name: "Pro Dive Shop",
          slug: "pro",
          currency: "EUR",
          timezone: "Europe/Paris",
        },
        branding: {
          primaryColor: "#ff6600",
          secondaryColor: "#fff4e6",
          logo: "https://example.com/logo.png",
        },
      });
    });

    it("should handle partial branding settings and apply defaults for missing values", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/partial");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrgWithPartialBranding);

      // Act
      const result = await loader({ request, params: { tenant: "partial" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("partial");
      expect(result).toEqual({
        organization: {
          id: "org-789",
          name: "Partial Dive Shop",
          slug: "partial",
          currency: "GBP",
          timezone: "UTC", // default applied
        },
        branding: {
          primaryColor: "#00cc66",
          secondaryColor: "#f0f9ff", // default applied
          logo: undefined, // default applied
        },
      });
    });
  });
});
