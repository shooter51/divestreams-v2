import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  updatePublicSiteSettings: vi.fn(),
}));

vi.mock("../../../../../lib/security/sanitize", () => ({
  sanitizeIframeEmbed: vi.fn((input) => input),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../../lib/db/public-site.server";
import { action } from "../../../../../app/routes/tenant/settings/public-site.content";

describe("tenant/settings/public-site.content route", () => {
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
    (updatePublicSiteSettings as Mock).mockResolvedValue(undefined);
  });

  describe("action", () => {
    it("updates content settings with all fields", async () => {
      const formData = new FormData();
      formData.append("intent", "update-content");
      formData.append("aboutContent", "We are a dive shop in Key Largo.");
      formData.append("heroImageUrl", "https://example.com/hero.jpg");
      formData.append("heroVideoUrl", "https://example.com/video.mp4");
      formData.append("logoUrl", "https://example.com/logo.png");
      formData.append("contactAddress", "123 Ocean Drive, Key Largo, FL");
      formData.append("contactPhone", "+1-555-1234");
      formData.append("contactEmail", "info@diveshop.com");
      formData.append("contactHours", "Mon-Fri: 8am-6pm");
      formData.append("mapEmbed", '<iframe src="https://maps.google.com/embed"></iframe>');

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/content", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toEqual({ success: true, message: "Content settings updated successfully" });
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        aboutContent: "We are a dive shop in Key Largo.",
        heroImageUrl: "https://example.com/hero.jpg",
        heroVideoUrl: "https://example.com/video.mp4",
        logoUrl: "https://example.com/logo.png",
        contactInfo: {
          address: "123 Ocean Drive, Key Largo, FL",
          phone: "+1-555-1234",
          email: "info@diveshop.com",
          hours: "Mon-Fri: 8am-6pm",
          mapEmbed: '<iframe src="https://maps.google.com/embed"></iframe>',
        },
      });
    });

    it("handles null/empty fields gracefully", async () => {
      const formData = new FormData();
      formData.append("intent", "update-content");
      // All content fields left empty

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/content", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toEqual({ success: true, message: "Content settings updated successfully" });
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        aboutContent: null,
        heroImageUrl: null,
        heroVideoUrl: null,
        logoUrl: null,
        contactInfo: {
          address: null,
          phone: null,
          email: null,
          hours: null,
          mapEmbed: null,
        },
      });
    });

    it("handles partial contact info", async () => {
      const formData = new FormData();
      formData.append("intent", "update-content");
      formData.append("contactEmail", "info@diveshop.com");
      formData.append("contactPhone", "+1-555-1234");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/content", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.success).toBe(true);
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", expect.objectContaining({
        contactInfo: expect.objectContaining({
          email: "info@diveshop.com",
          phone: "+1-555-1234",
          address: null,
          hours: null,
          mapEmbed: null,
        }),
      }));
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/content", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });

    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("intent", "update-content");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/content", {
        method: "POST",
        body: formData,
      });
      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });
  });
});
