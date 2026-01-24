import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/profile";

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../../lib/db", () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    metadata: "metadata",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

describe("tenant/settings/profile route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: {
      id: "org-uuid",
      name: "Demo Dive Shop",
      slug: "demo",
      metadata: JSON.stringify({
        email: "shop@example.com",
        phone: "+1-555-1234",
        website: "https://demo.divestreams.com",
        timezone: "America/New_York",
        currency: "USD",
        address: {
          street: "123 Ocean Blvd",
          city: "Miami",
          state: "FL",
          country: "USA",
          postalCode: "33139",
        },
        booking: {
          minAdvanceBooking: 24,
          maxAdvanceBooking: 90,
          cancellationPolicy: "48h",
          requireDeposit: true,
          depositPercent: 25,
        },
      }),
    },
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
      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns profile data from org metadata", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.profile.name).toBe("Demo Dive Shop");
      expect(result.profile.slug).toBe("demo");
      expect(result.profile.email).toBe("shop@example.com");
      expect(result.profile.phone).toBe("+1-555-1234");
      expect(result.profile.website).toBe("https://demo.divestreams.com");
      expect(result.profile.timezone).toBe("America/New_York");
      expect(result.profile.currency).toBe("USD");
    });

    it("returns address data from org metadata", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.profile.address).toMatchObject({
        street: "123 Ocean Blvd",
        city: "Miami",
        state: "FL",
        country: "USA",
        postalCode: "33139",
      });
    });

    it("returns booking settings from org metadata", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.profile.bookingSettings).toMatchObject({
        minAdvanceBooking: 24,
        maxAdvanceBooking: 90,
        cancellationPolicy: "48h",
        requireDeposit: true,
        depositPercent: 25,
      });
    });

    it("returns default values when metadata is empty", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: {
          ...mockOrgContext.org,
          metadata: null,
        },
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.profile.email).toBe("");
      expect(result.profile.phone).toBe("");
      expect(result.profile.website).toBe("");
      expect(result.profile.timezone).toBe("America/New_York");
      expect(result.profile.currency).toBe("USD");
      expect(result.profile.address.street).toBe("");
      expect(result.profile.bookingSettings.minAdvanceBooking).toBe(24);
      expect(result.profile.bookingSettings.requireDeposit).toBe(false);
    });

    it("returns orgId and isPremium", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/profile");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.orgId).toBe("org-uuid");
      expect(result.isPremium).toBe(false);
    });
  });

  describe("action", () => {
    describe("update-profile intent", () => {
      it("updates profile information", async () => {
        const formData = new FormData();
        formData.append("intent", "update-profile");
        formData.append("name", "Updated Dive Shop");
        formData.append("email", "updated@example.com");
        formData.append("phone", "+1-555-5678");
        formData.append("website", "https://updated.divestreams.com");
        formData.append("timezone", "America/Los_Angeles");
        formData.append("currency", "EUR");
        formData.append("street", "456 Beach Ave");
        formData.append("city", "San Diego");
        formData.append("state", "CA");
        formData.append("country", "USA");
        formData.append("postalCode", "92101");

        const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Profile updated successfully",
        });
      });

      it("handles optional fields being empty", async () => {
        const formData = new FormData();
        formData.append("intent", "update-profile");
        formData.append("name", "Basic Dive Shop");
        formData.append("email", "basic@example.com");
        formData.append("phone", "");
        formData.append("website", "");
        formData.append("timezone", "America/New_York");
        formData.append("currency", "USD");

        const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          success: true,
          message: "Profile updated successfully",
        });
      });
    });

    describe("update-booking-settings intent", () => {
      it("updates booking settings", async () => {
        const formData = new FormData();
        formData.append("intent", "update-booking-settings");
        formData.append("minAdvanceBooking", "12");
        formData.append("maxAdvanceBooking", "180");
        formData.append("cancellationPolicy", "72h");
        formData.append("requireDeposit", "true");
        formData.append("depositPercent", "50");

        const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Booking settings updated",
        });
      });

      it("handles default values for booking settings", async () => {
        const formData = new FormData();
        formData.append("intent", "update-booking-settings");

        const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          success: true,
          message: "Booking settings updated",
        });
      });

      it("handles requireDeposit as false", async () => {
        const formData = new FormData();
        formData.append("intent", "update-booking-settings");
        formData.append("minAdvanceBooking", "24");
        formData.append("maxAdvanceBooking", "90");
        formData.append("cancellationPolicy", "24h");
        // Not including requireDeposit means false
        formData.append("depositPercent", "25");

        const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          success: true,
          message: "Booking settings updated",
        });
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toBeNull();
    });

    it("preserves existing metadata when updating profile", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: {
          ...mockOrgContext.org,
          metadata: JSON.stringify({
            existingField: "should be preserved",
            booking: { minAdvanceBooking: 48 },
          }),
        },
      });

      const formData = new FormData();
      formData.append("intent", "update-profile");
      formData.append("name", "Updated Shop");
      formData.append("email", "new@example.com");
      formData.append("timezone", "America/Chicago");
      formData.append("currency", "USD");

      const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result?.success).toBe(true);
    });

    it("preserves existing metadata when updating booking settings", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: {
          ...mockOrgContext.org,
          metadata: JSON.stringify({
            email: "existing@example.com",
            booking: { existingField: "preserved" },
          }),
        },
      });

      const formData = new FormData();
      formData.append("intent", "update-booking-settings");
      formData.append("minAdvanceBooking", "24");

      const request = new Request("https://demo.divestreams.com/tenant/settings/profile", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result?.success).toBe(true);
    });
  });
});
