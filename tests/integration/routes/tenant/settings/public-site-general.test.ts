import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/public-site.server", () => ({
  updatePublicSiteSettings: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    customDomain: "customDomain",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../../lib/db/public-site.server";
import { db } from "../../../../../lib/db";
import { action } from "../../../../../app/routes/tenant/settings/public-site.general";

describe("tenant/settings/public-site.general route", () => {
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
    it("updates general settings with enabled and pages", async () => {
      const formData = new FormData();
      formData.append("intent", "update-general");
      formData.append("enabled", "true");
      formData.append("page-home", "true");
      formData.append("page-about", "true");
      formData.append("page-trips", "true");
      formData.append("page-courses", "true");
      formData.append("page-contact", "true");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        enabled: true,
        pages: {
          home: true,
          about: true,
          trips: true,
          courses: true,
          equipment: false,
          contact: true,
          gallery: false,
        },
      });
      expect(result).toEqual({ success: true, message: "General settings updated successfully" });
    });

    it("updates customDomain when changed", async () => {
      const formData = new FormData();
      formData.append("intent", "update-general");
      formData.append("enabled", "true");
      formData.append("customDomain", "www.mydiveshop.com");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
        method: "POST",
        body: formData,
      });
      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      // customDomain changed from null to "www.mydiveshop.com", so db.update should be called
      expect(db.update).toHaveBeenCalled();
    });

    it("does not update customDomain when unchanged", async () => {
      const formData = new FormData();
      formData.append("intent", "update-general");
      formData.append("enabled", "true");
      // customDomain not appended, so it defaults to null which matches org.customDomain

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
        method: "POST",
        body: formData,
      });
      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      // customDomain is null in both org context and form, so db.update should NOT be called
      expect(db.update).not.toHaveBeenCalled();
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-intent");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });

    it("handles disabled site with all pages off", async () => {
      const formData = new FormData();
      formData.append("intent", "update-general");
      // enabled not checked = false, no page toggles = all false

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(updatePublicSiteSettings).toHaveBeenCalledWith("org-uuid", {
        enabled: false,
        pages: {
          home: false,
          about: false,
          trips: false,
          courses: false,
          equipment: false,
          contact: false,
          gallery: false,
        },
      });
      expect(result).toEqual({ success: true, message: "General settings updated successfully" });
    });
  });
});
