/**
 * Unit tests for Google Calendar booking sync
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the google-calendar server module
vi.mock("../../../../lib/integrations/google-calendar.server", () => ({
  syncTripToCalendar: vi.fn(),
}));

vi.mock("../../../../lib/logger", () => ({
  integrationLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Google Calendar Booking Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncBookingToCalendar", () => {
    it("should return success when syncTripToCalendar succeeds", async () => {
      const { syncTripToCalendar } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );
      vi.mocked(syncTripToCalendar).mockResolvedValue({ success: true });

      const { syncBookingToCalendar } = await import(
        "../../../../lib/integrations/google-calendar-bookings.server"
      );

      const result = await syncBookingToCalendar("org-1", "trip-1", "UTC");
      expect(result.success).toBe(true);
    });

    it("should return failure and log error when syncTripToCalendar throws", async () => {
      const { syncTripToCalendar } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );
      vi.mocked(syncTripToCalendar).mockRejectedValue(new Error("API error"));

      const { syncBookingToCalendar } = await import(
        "../../../../lib/integrations/google-calendar-bookings.server"
      );
      const { integrationLogger } = await import("../../../../lib/logger");

      const result = await syncBookingToCalendar("org-1", "trip-1", "UTC");
      expect(result.success).toBe(false);
      expect(result.error).toBe("API error");
      expect(integrationLogger.error).toHaveBeenCalledOnce();
    });
  });

  describe("syncBookingCancellationToCalendar", () => {
    it("should return success when syncTripToCalendar succeeds", async () => {
      const { syncTripToCalendar } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );
      vi.mocked(syncTripToCalendar).mockResolvedValue({ success: true });

      const { syncBookingCancellationToCalendar } = await import(
        "../../../../lib/integrations/google-calendar-bookings.server"
      );

      const result = await syncBookingCancellationToCalendar("org-1", "trip-1");
      expect(result.success).toBe(true);
    });
  });

  describe("syncTripsToCalendar", () => {
    it("should return placeholder success result", async () => {
      const { syncTripsToCalendar } = await import(
        "../../../../lib/integrations/google-calendar-bookings.server"
      );

      const result = await syncTripsToCalendar("org-1");
      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
    });
  });
});
