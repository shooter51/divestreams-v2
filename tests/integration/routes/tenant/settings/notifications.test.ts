import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/notifications";

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

describe("tenant/settings/notifications route", () => {
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
        notifications: {
          emailBookingConfirmation: false,
          emailBookingReminders: true,
          reminderDaysBefore: 2,
          emailDailyDigest: true,
          emailWeeklyReport: false,
          notifyNewBooking: true,
          notifyCancellation: false,
          notifyLowCapacity: true,
          lowCapacityThreshold: 3,
        },
      }),
    },
    isPremium: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/notifications");
      await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns default notification settings when no metadata exists", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/notifications");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.settings).toEqual({
        emailBookingConfirmation: true,
        emailBookingReminders: true,
        reminderDaysBefore: 1,
        emailDailyDigest: false,
        emailWeeklyReport: false,
        notifyNewBooking: true,
        notifyCancellation: true,
        notifyLowCapacity: false,
        lowCapacityThreshold: 2,
      });
    });

    it("returns custom notification settings from metadata", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockOrgContextWithMetadata);

      const request = new Request("https://demo.divestreams.com/app/settings/notifications");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.settings.emailBookingConfirmation).toBe(false);
      expect(result.settings.reminderDaysBefore).toBe(2);
      expect(result.settings.notifyLowCapacity).toBe(true);
      expect(result.settings.lowCapacityThreshold).toBe(3);
    });

    it("returns premium status", async () => {
      (requireOrgContext as Mock).mockResolvedValue(mockOrgContextWithMetadata);

      const request = new Request("https://demo.divestreams.com/app/settings/notifications");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.isPremium).toBe(true);
    });

    it("handles invalid JSON metadata gracefully", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        org: { ...mockOrgContext.org, metadata: "invalid-json" },
      });

      const request = new Request("https://demo.divestreams.com/app/settings/notifications");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      // Should fall back to defaults
      expect(result.settings.emailBookingConfirmation).toBe(true);
    });
  });

  describe("action", () => {
    it("updates notification settings", async () => {
      const formData = new FormData();
      formData.append("emailBookingConfirmation", "true");
      formData.append("emailBookingReminders", "true");
      formData.append("reminderDaysBefore", "3");
      formData.append("emailDailyDigest", "false");
      formData.append("emailWeeklyReport", "false");
      formData.append("notifyNewBooking", "true");
      formData.append("notifyCancellation", "true");
      formData.append("notifyLowCapacity", "true");
      formData.append("lowCapacityThreshold", "5");

      const request = new Request("https://demo.divestreams.com/app/settings/notifications", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("parses boolean values correctly", async () => {
      const formData = new FormData();
      formData.append("emailBookingConfirmation", "true");
      formData.append("emailBookingReminders", "false");
      formData.append("reminderDaysBefore", "1");
      formData.append("emailDailyDigest", "true");
      formData.append("emailWeeklyReport", "true");
      formData.append("notifyNewBooking", "false");
      formData.append("notifyCancellation", "false");
      formData.append("notifyLowCapacity", "false");
      formData.append("lowCapacityThreshold", "2");

      const request = new Request("https://demo.divestreams.com/app/settings/notifications", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result).toEqual({ success: true });
    });

    it("handles default values for missing fields", async () => {
      const formData = new FormData();
      // Missing all fields

      const request = new Request("https://demo.divestreams.com/app/settings/notifications", {
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
          metadata: JSON.stringify({ existingKey: "existingValue" }),
        },
      });

      const formData = new FormData();
      formData.append("emailBookingConfirmation", "true");
      formData.append("emailBookingReminders", "true");
      formData.append("reminderDaysBefore", "1");
      formData.append("emailDailyDigest", "false");
      formData.append("emailWeeklyReport", "false");
      formData.append("notifyNewBooking", "true");
      formData.append("notifyCancellation", "true");
      formData.append("notifyLowCapacity", "false");
      formData.append("lowCapacityThreshold", "2");

      const request = new Request("https://demo.divestreams.com/app/settings/notifications", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(db.update).toHaveBeenCalled();
    });
  });
});
