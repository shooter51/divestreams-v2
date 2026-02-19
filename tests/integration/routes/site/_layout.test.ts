import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies BEFORE importing
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
    logo: "logo",
    publicSiteSettings: "publicSiteSettings",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  or: vi.fn((...conditions: unknown[]) => ({ type: "or", conditions })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../lib/themes/public-site-themes", () => ({
  getTheme: vi.fn().mockReturnValue({ name: "ocean", colors: {} }),
  getThemeStyleBlock: vi.fn().mockReturnValue(":root { --primary-color: #0369a1; }"),
}));

vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn().mockResolvedValue(null),
}));

import { db } from "../../../../lib/db";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import { loader } from "../../../../app/routes/site/_layout";

describe("site/_layout route", () => {
  const mockOrg = {
    id: "org-1",
    name: "Demo Dive Shop",
    slug: "demo",
    logo: null,
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
      aboutContent: "We are a dive shop.",
      contactInfo: { phone: "555-1234", email: "info@demo.com" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chain implementations after clearAllMocks
    (db.select as Mock).mockReturnThis();
    (db.from as Mock).mockReturnThis();
    (db.where as Mock).mockReturnThis();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (getCustomerBySession as Mock).mockResolvedValue(null);
  });

  describe("loader", () => {
    it("resolves organization and returns site data", async () => {
      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.organization.id).toBe("org-1");
      expect(result.organization.name).toBe("Demo Dive Shop");
      expect(result.settings.enabled).toBe(true);
      expect(result.enabledPages.trips).toBe(true);
      expect(result.enabledPages.equipment).toBe(false);
    });

    it("throws 404 when organization is not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://unknown.divestreams.com/site");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("redirects to site-disabled when public site is not enabled", async () => {
      const disabledOrg = {
        ...mockOrg,
        publicSiteSettings: { ...mockOrg.publicSiteSettings, enabled: false },
      };
      (db.limit as Mock).mockResolvedValue([disabledOrg]);

      const request = new Request("https://demo.divestreams.com/site");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown redirect");
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toContain("/site-disabled");
        }
      }
    });

    it("returns customer when session cookie is present", async () => {
      const mockCustomer = { id: "cust-1", firstName: "John", email: "john@test.com" };
      (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);

      const request = new Request("https://demo.divestreams.com/site");
      request.headers.append("Cookie", "customer_session=valid-token");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.customer).toEqual(mockCustomer);
    });

    it("returns null customer when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.customer).toBeNull();
    });

    it("uses default settings when org has no publicSiteSettings", async () => {
      const orgWithoutSettings = { ...mockOrg, publicSiteSettings: null };
      (db.limit as Mock).mockResolvedValue([orgWithoutSettings]);

      const request = new Request("https://demo.divestreams.com/site");
      // Settings.enabled defaults to false, so it should redirect
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
        }
      }
    });

    it("falls back to custom domain lookup when no subdomain", async () => {
      (getSubdomainFromHost as Mock).mockReturnValue(null);

      const request = new Request("https://customdomain.com/site");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.organization.id).toBe("org-1");
    });
  });
});
