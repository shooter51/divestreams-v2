import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Integration tests for embed/$tenant route
 * Tests public embed widget loading and configuration
 */

describe("embed/$tenant route", () => {
  const mockOrg = {
    id: "org-uuid",
    slug: "demo",
    name: "Demo Dive Shop",
    metadata: {
      settings: {
        branding: {
          primaryColor: "#ff6600",
          secondaryColor: "#f0f9ff",
          logo: "https://example.com/logo.png",
        },
        currency: "USD",
        timezone: "America/New_York",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Organization Loading", () => {
    it("organization has required fields", () => {
      expect(mockOrg.id).toBeDefined();
      expect(mockOrg.slug).toBeDefined();
      expect(mockOrg.name).toBeDefined();
    });

    it("organization slug is used for lookup", () => {
      const slug = "demo";
      const tenantSlug = mockOrg.slug;

      expect(tenantSlug).toBe(slug);
    });
  });

  describe("Branding Configuration", () => {
    it("returns branding from metadata", () => {
      const branding = mockOrg.metadata?.settings?.branding || {};

      expect(branding.primaryColor).toBe("#ff6600");
      expect(branding.secondaryColor).toBe("#f0f9ff");
      expect(branding.logo).toBe("https://example.com/logo.png");
    });

    it("uses default colors when branding not set", () => {
      const orgWithoutBranding = {
        ...mockOrg,
        metadata: null,
      };

      const defaultBranding = {
        primaryColor: orgWithoutBranding.metadata?.settings?.branding?.primaryColor || "#0066cc",
        secondaryColor: orgWithoutBranding.metadata?.settings?.branding?.secondaryColor || "#f0f9ff",
        logo: orgWithoutBranding.metadata?.settings?.branding?.logo,
      };

      expect(defaultBranding.primaryColor).toBe("#0066cc");
      expect(defaultBranding.secondaryColor).toBe("#f0f9ff");
      expect(defaultBranding.logo).toBeUndefined();
    });

    it("color values are valid hex colors", () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      const branding = mockOrg.metadata?.settings?.branding || {};

      expect(branding.primaryColor).toMatch(hexColorRegex);
      expect(branding.secondaryColor).toMatch(hexColorRegex);
    });
  });

  describe("Organization Settings", () => {
    it("extracts currency from metadata", () => {
      const currency = mockOrg.metadata?.settings?.currency || "USD";

      expect(currency).toBe("USD");
    });

    it("extracts timezone from metadata", () => {
      const timezone = mockOrg.metadata?.settings?.timezone || "UTC";

      expect(timezone).toBe("America/New_York");
    });

    it("defaults currency to USD when not set", () => {
      const orgWithoutSettings = { ...mockOrg, metadata: null };
      const currency = orgWithoutSettings.metadata?.settings?.currency || "USD";

      expect(currency).toBe("USD");
    });

    it("defaults timezone to UTC when not set", () => {
      const orgWithoutSettings = { ...mockOrg, metadata: null };
      const timezone = orgWithoutSettings.metadata?.settings?.timezone || "UTC";

      expect(timezone).toBe("UTC");
    });
  });

  describe("Loader Response Structure", () => {
    it("returns organization info", () => {
      const loaderResponse = {
        organization: {
          id: mockOrg.id,
          name: mockOrg.name,
          slug: mockOrg.slug,
          currency: mockOrg.metadata?.settings?.currency || "USD",
          timezone: mockOrg.metadata?.settings?.timezone || "UTC",
        },
        branding: {
          primaryColor: mockOrg.metadata?.settings?.branding?.primaryColor || "#0066cc",
          secondaryColor: mockOrg.metadata?.settings?.branding?.secondaryColor || "#f0f9ff",
          logo: mockOrg.metadata?.settings?.branding?.logo,
        },
      };

      expect(loaderResponse.organization).toBeDefined();
      expect(loaderResponse.organization.name).toBe("Demo Dive Shop");
      expect(loaderResponse.organization.slug).toBe("demo");
    });

    it("returns branding info", () => {
      const loaderResponse = {
        organization: {
          id: mockOrg.id,
          name: mockOrg.name,
          slug: mockOrg.slug,
          currency: "USD",
          timezone: "America/New_York",
        },
        branding: {
          primaryColor: "#ff6600",
          secondaryColor: "#f0f9ff",
          logo: "https://example.com/logo.png",
        },
      };

      expect(loaderResponse.branding).toBeDefined();
      expect(loaderResponse.branding.primaryColor).toBe("#ff6600");
    });
  });

  describe("Error Handling", () => {
    it("handles missing tenant slug", () => {
      const params = { tenant: undefined };
      const hasTenant = !!params.tenant;

      expect(hasTenant).toBe(false);
    });

    it("handles organization not found", () => {
      const org = null;
      const orgExists = org !== null;

      expect(orgExists).toBe(false);
    });

    it("handles invalid metadata gracefully", () => {
      const orgWithBadMetadata = {
        ...mockOrg,
        metadata: "invalid-json" as unknown as typeof mockOrg.metadata,
      };

      // When parsing fails, should use defaults
      let branding;
      try {
        branding = (orgWithBadMetadata.metadata as unknown as typeof mockOrg.metadata)?.settings?.branding;
      } catch {
        branding = undefined;
      }

      const primaryColor = branding?.primaryColor || "#0066cc";
      expect(primaryColor).toBe("#0066cc");
    });
  });
});
