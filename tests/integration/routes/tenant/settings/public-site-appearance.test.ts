import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  updatePublicSiteSettings: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../../lib/db/public-site.server";
import { action } from "../../../../../app/routes/tenant/settings/public-site.appearance";

describe("tenant/settings/public-site.appearance route", () => {
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
    it("validates hex colors and returns error for invalid primary color", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      formData.append("theme", "ocean");
      formData.append("primaryColor", "not-a-hex");
      formData.append("secondaryColor", "#06b6d4");
      formData.append("fontFamily", "inter");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid color format");
      expect(updatePublicSiteSettings).not.toHaveBeenCalled();
    });

    it("validates hex colors and returns error for invalid secondary color", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      formData.append("theme", "ocean");
      formData.append("primaryColor", "#0ea5e9");
      formData.append("secondaryColor", "rgb(6,182,212)");
      formData.append("fontFamily", "inter");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid color format");
    });

    it("validates theme and returns error for invalid theme", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      formData.append("theme", "neon");
      formData.append("primaryColor", "#0ea5e9");
      formData.append("secondaryColor", "#06b6d4");
      formData.append("fontFamily", "inter");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid theme");
    });

    it("validates font family and returns error for invalid font", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      formData.append("theme", "ocean");
      formData.append("primaryColor", "#0ea5e9");
      formData.append("secondaryColor", "#06b6d4");
      formData.append("fontFamily", "comic-sans");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid font family");
    });

    it("updates appearance settings on valid input", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      formData.append("theme", "tropical");
      formData.append("primaryColor", "#14b8a6");
      formData.append("secondaryColor", "#0d9488");
      formData.append("fontFamily", "poppins");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Appearance settings updated successfully");
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        theme: "tropical",
        primaryColor: "#14b8a6",
        secondaryColor: "#0d9488",
        fontFamily: "poppins",
      });
    });

    it("uses default values when fields are empty", async () => {
      const formData = new FormData();
      formData.append("intent", "update-appearance");
      // All fields empty - should use defaults

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.success).toBe(true);
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        theme: "ocean",
        primaryColor: "#0ea5e9",
        secondaryColor: "#06b6d4",
        fontFamily: "inter",
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result).toBeNull();
    });

    it("accepts all valid theme values", async () => {
      for (const theme of ["ocean", "tropical", "minimal", "dark", "classic"]) {
        vi.clearAllMocks();
        (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
        (updatePublicSiteSettings as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "update-appearance");
        formData.append("theme", theme);
        formData.append("primaryColor", "#0ea5e9");
        formData.append("secondaryColor", "#06b6d4");
        formData.append("fontFamily", "inter");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(true);
      }
    });

    it("accepts all valid font family values", async () => {
      for (const font of ["inter", "poppins", "roboto", "open-sans"]) {
        vi.clearAllMocks();
        (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
        (updatePublicSiteSettings as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "update-appearance");
        formData.append("theme", "ocean");
        formData.append("primaryColor", "#0ea5e9");
        formData.append("secondaryColor", "#06b6d4");
        formData.append("fontFamily", font);

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/appearance", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(true);
      }
    });
  });
});
