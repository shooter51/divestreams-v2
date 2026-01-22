/**
 * Site Layout Route Tests
 *
 * Tests the public site layout with tenant resolution and theme application.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/site/_layout";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked db
import { db } from "../../../../lib/db";

describe("Route: site/_layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    const mockOrgWithSubdomain = {
      id: "org-123",
      name: "Demo Dive Shop",
      slug: "demo",
      logo: "https://example.com/logo.png",
      publicSiteSettings: {
        enabled: true,
        theme: "ocean",
        primaryColor: "",
        secondaryColor: "",
        logoUrl: null,
        heroImageUrl: null,
        heroVideoUrl: null,
        fontFamily: "inter",
        pages: {
          home: true,
          about: true,
          trips: true,
          courses: true,
          equipment: false,
          contact: true,
          gallery: false,
        },
        aboutContent: null,
        contactInfo: null,
      },
    };

    const mockOrgWithCustomDomain = {
      id: "org-456",
      name: "Custom Dive Shop",
      slug: "custom",
      logo: null,
      customDomain: "diveshop.com",
      publicSiteSettings: {
        enabled: true,
        theme: "tropical",
        primaryColor: "#ff0000",
        secondaryColor: "#00ff00",
        logoUrl: "https://example.com/custom-logo.png",
        heroImageUrl: null,
        heroVideoUrl: null,
        fontFamily: "poppins",
        pages: {
          home: true,
          about: false,
          trips: true,
          courses: false,
          equipment: true,
          contact: true,
          gallery: true,
        },
        aboutContent: "About us content",
        contactInfo: {
          email: "info@diveshop.com",
          phone: "+1234567890",
          address: "123 Ocean Ave",
        },
      },
    };

    const mockOrgDisabledSite = {
      id: "org-789",
      name: "Disabled Shop",
      slug: "disabled",
      logo: null,
      publicSiteSettings: {
        enabled: false,
        theme: "ocean",
        primaryColor: "",
        secondaryColor: "",
        logoUrl: null,
        heroImageUrl: null,
        heroVideoUrl: null,
        fontFamily: "inter",
        pages: {
          home: true,
          about: true,
          trips: true,
          courses: true,
          equipment: false,
          contact: true,
          gallery: false,
        },
        aboutContent: null,
        contactInfo: null,
      },
    };

    it("should throw 404 when organization not found by subdomain", async () => {
      // Arrange
      const request = new Request("http://nonexistent.localhost:5173/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load organization by subdomain with localhost", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrgWithSubdomain]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organization).toEqual({
        id: "org-123",
        name: "Demo Dive Shop",
        slug: "demo",
        logo: "https://example.com/logo.png",
      });
      expect(result.settings.theme).toBe("ocean");
      expect(result.themeVars.primaryColor).toBe("#0077b6"); // ocean preset primary
      expect(result.themeVars.fontFamily).toBe("'Inter', system-ui, sans-serif");
      expect(result.enabledPages).toEqual({
        home: true,
        about: true,
        trips: true,
        courses: true,
        equipment: false,
        contact: true,
        gallery: false,
      });
    });

    it("should load organization by subdomain with production domain", async () => {
      // Arrange
      const request = new Request("http://demo.divestreams.com/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrgWithSubdomain]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organization.slug).toBe("demo");
      expect(result.settings.theme).toBe("ocean");
    });

    it("should load organization by custom domain", async () => {
      // Arrange
      const request = new Request("http://diveshop.com/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrgWithCustomDomain]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organization).toEqual({
        id: "org-456",
        name: "Custom Dive Shop",
        slug: "custom",
        logo: "https://example.com/custom-logo.png",
      });
      expect(result.settings.theme).toBe("tropical");
      expect(result.themeVars.primaryColor).toBe("#ff0000"); // custom color override
      expect(result.themeVars.secondaryColor).toBe("#00ff00"); // custom color override
      expect(result.themeVars.fontFamily).toBe("'Poppins', system-ui, sans-serif");
      expect(result.contactInfo).toEqual({
        email: "info@diveshop.com",
        phone: "+1234567890",
        address: "123 Ocean Ave",
      });
    });

    it("should apply default settings when publicSiteSettings is null", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");
      const orgWithoutSettings = {
        ...mockOrgWithSubdomain,
        publicSiteSettings: null,
      };
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([orgWithoutSettings]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        // Should redirect because default enabled is false
        expect(error.status).toBe(302);
      }
    });

    it("should redirect when public site is disabled", async () => {
      // Arrange
      const request = new Request("http://disabled.localhost:5173/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrgDisabledSite]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toContain("/site-disabled");
        expect(error.headers.get("Location")).toContain("org=Disabled%20Shop");
      }
    });

    it("should ignore www subdomain and try custom domain lookup", async () => {
      // Arrange
      const request = new Request("http://www.divestreams.com/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should ignore admin subdomain and try custom domain lookup", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/site");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });
});
