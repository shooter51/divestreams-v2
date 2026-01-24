import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/booking-widget";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  organization: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

describe("tenant/settings/booking-widget route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: {
      id: "org-uuid",
      name: "Demo Dive Shop",
      slug: "demo",
      metadata: null,
    },
    membership: { role: "owner" },
    subscription: null,
    isPremium: false,
  };

  const mockOrgContextWithMetadata = {
    ...mockOrgContext,
    org: {
      ...mockOrgContext.org,
      metadata: JSON.stringify({
        widget: {
          primaryColor: "#ff0000",
          buttonText: "Reserve Now",
          showPrices: false,
          showAvailability: true,
          showDescription: false,
          layout: "list",
          maxTripsShown: 9,
        },
        branding: {
          primaryColor: "#ff0000",
        },
      }),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    // Mock APP_URL env var
    process.env.APP_URL = "https://divestreams.com";
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns default widget settings when no metadata exists", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.settings).toEqual({
        primaryColor: "#2563eb",
        buttonText: "Book Now",
        showPrices: true,
        showAvailability: true,
        showDescription: true,
        layout: "grid",
        maxTripsShown: 6,
      });
    });

    it("returns custom widget settings from metadata", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockOrgContextWithMetadata);

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.settings.primaryColor).toBe("#ff0000");
      expect(result.settings.buttonText).toBe("Reserve Now");
      expect(result.settings.showPrices).toBe(false);
      expect(result.settings.layout).toBe("list");
      expect(result.settings.maxTripsShown).toBe(9);
    });

    it("returns embed URL", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.embedUrl).toBe("https://divestreams.com/embed/demo");
    });

    it("returns org name and slug", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.orgSlug).toBe("demo");
      expect(result.orgName).toBe("Demo Dive Shop");
    });

    it("handles invalid JSON metadata gracefully", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: { ...mockOrgContext.org, metadata: "invalid-json" },
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      // Should fall back to defaults
      expect(result.settings.primaryColor).toBe("#2563eb");
    });

    it("uses branding color as fallback for widget color", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: {
          ...mockOrgContext.org,
          metadata: JSON.stringify({
            branding: { primaryColor: "#123456" },
            // no widget settings
          }),
        },
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.settings.primaryColor).toBe("#123456");
    });
  });

  describe("action", () => {
    it("updates widget settings", async () => {
      const formData = new FormData();
      formData.append("primaryColor", "#00ff00");
      formData.append("buttonText", "Book Your Dive");
      formData.append("showPrices", "true");
      formData.append("showAvailability", "true");
      formData.append("showDescription", "false");
      formData.append("layout", "list");
      formData.append("maxTripsShown", "12");

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("also updates branding color when widget color changes", async () => {
      const formData = new FormData();
      formData.append("primaryColor", "#abcdef");
      formData.append("buttonText", "Book Now");
      formData.append("showPrices", "true");
      formData.append("showAvailability", "true");
      formData.append("showDescription", "true");
      formData.append("layout", "grid");
      formData.append("maxTripsShown", "6");

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
    });

    it("handles default values for missing fields", async () => {
      const formData = new FormData();
      // Only provide some fields

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("preserves existing metadata when updating", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: {
          ...mockOrgContext.org,
          metadata: JSON.stringify({
            existingKey: "existingValue",
            notifications: { emailBookingConfirmation: true },
          }),
        },
      });

      const formData = new FormData();
      formData.append("primaryColor", "#2563eb");
      formData.append("buttonText", "Book Now");
      formData.append("showPrices", "true");
      formData.append("showAvailability", "true");
      formData.append("showDescription", "true");
      formData.append("layout", "grid");
      formData.append("maxTripsShown", "6");

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
    });

    it("handles checkbox fields correctly", async () => {
      const formData = new FormData();
      formData.append("primaryColor", "#2563eb");
      formData.append("buttonText", "Book Now");
      // Unchecked checkboxes are not submitted
      // formData.append("showPrices", "true");
      formData.append("showAvailability", "true");
      // formData.append("showDescription", "true");
      formData.append("layout", "grid");
      formData.append("maxTripsShown", "6");

      const request = new Request("https://demo.divestreams.com/tenant/settings/booking-widget", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true });
    });
  });
});
