import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getBaseDomain: vi.fn(() => "divestreams.com"),
  getTenantUrl: vi.fn((slug, path) => `https://${slug}.divestreams.com${path}`),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getPublicSiteSettings } from "../../../../../lib/db/public-site.server";
import { loader } from "../../../../../app/routes/tenant/settings/public-site";

describe("tenant/settings/public-site route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      (getPublicSiteSettings as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns default settings when settings are null", async () => {
      (getPublicSiteSettings as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.settings.enabled).toBe(false);
      expect(result.settings.theme).toBe("ocean");
      expect(result.settings.primaryColor).toBe("#0ea5e9");
      expect(result.settings.secondaryColor).toBe("#06b6d4");
      expect(result.settings.fontFamily).toBe("inter");
      expect(result.settings.pages.home).toBe(true);
      expect(result.settings.pages.about).toBe(true);
      expect(result.settings.pages.equipment).toBe(false);
      expect(result.settings.pages.gallery).toBe(false);
    });

    it("returns actual settings when they exist", async () => {
      const mockSettings = {
        enabled: true,
        theme: "tropical",
        primaryColor: "#14b8a6",
        secondaryColor: "#0d9488",
        fontFamily: "poppins",
        pages: {
          home: true,
          about: true,
          trips: true,
          courses: false,
          equipment: true,
          contact: true,
          gallery: true,
        },
        aboutContent: "Welcome to our dive shop",
        contactInfo: { phone: "+1-555-1234" },
      };
      (getPublicSiteSettings as Mock).mockResolvedValue(mockSettings);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.settings).toEqual(mockSettings);
    });

    it("returns org info and derived URLs", async () => {
      (getPublicSiteSettings as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.orgSlug).toBe("demo");
      expect(result.baseDomain).toBe("divestreams.com");
      expect(result.publicSiteUrl).toBe("https://demo.divestreams.com/site");
      expect(result.customDomain).toBeNull();
      expect(result.isPremium).toBe(false);
    });

    it("returns customDomain from org context", async () => {
      const ctxWithDomain = {
        ...mockOrgContext,
        org: { ...mockOrgContext.org, customDomain: "www.example.com" },
      };
      (requireOrgContext as Mock).mockResolvedValue(ctxWithDomain);
      (getPublicSiteSettings as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.customDomain).toBe("www.example.com");
    });
  });
});
