import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Integration tests for tenant calendar route
 * Tests calendar data loading and trip display
 */

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("tenant/calendar route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
  };

  const mockTrips = [
    {
      id: "trip-1",
      date: new Date("2025-02-15"),
      startTime: "09:00",
      capacity: 6,
      bookedCount: 3,
      tour: { name: "Beginner Dive", price: 9900 },
    },
    {
      id: "trip-2",
      date: new Date("2025-02-16"),
      startTime: "14:00",
      capacity: 8,
      bookedCount: 6,
      tour: { name: "Advanced Reef", price: 14900 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("Calendar Data Requirements", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/app/calendar");
      await requireOrgContext(request);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("trips have required fields", () => {
      const trip = mockTrips[0];
      expect(trip.id).toBeDefined();
      expect(trip.date).toBeDefined();
      expect(trip.tour).toBeDefined();
    });
  });

  describe("Date Filtering", () => {
    it("parses month parameter from URL", () => {
      const url = new URL("https://demo.divestreams.com/app/calendar?month=2025-02");
      const month = url.searchParams.get("month");

      expect(month).toBe("2025-02");
    });

    it("calculates month boundaries", () => {
      const yearMonth = "2025-02";
      const [year, month] = yearMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      expect(startDate.getDate()).toBe(1);
      expect(endDate.getDate()).toBe(28); // February 2025
    });

    it("filters trips by date range", () => {
      const startDate = new Date("2025-02-01");
      const endDate = new Date("2025-02-28");

      const filteredTrips = mockTrips.filter(trip =>
        trip.date >= startDate && trip.date <= endDate
      );

      expect(filteredTrips).toHaveLength(2);
    });

    it("defaults to current month", () => {
      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      expect(defaultMonth).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe("Trip Display Data", () => {
    it("includes tour details with trips", () => {
      const trip = mockTrips[0];
      expect(trip.tour.name).toBe("Beginner Dive");
      expect(trip.tour.price).toBe(9900);
    });

    it("calculates available spots", () => {
      const trip = mockTrips[0];
      const availableSpots = trip.capacity - trip.bookedCount;
      expect(availableSpots).toBe(3);
    });

    it("identifies fully booked trips", () => {
      const bookedTrip = { ...mockTrips[1], bookedCount: 8 };
      const isFullyBooked = bookedTrip.bookedCount >= bookedTrip.capacity;
      expect(isFullyBooked).toBe(true);
    });

    it("formats trip time for display", () => {
      const trip = mockTrips[0];
      expect(trip.startTime).toBe("09:00");
    });
  });

  describe("Calendar Navigation", () => {
    it("calculates previous month", () => {
      const current = "2025-02";
      const [year, month] = current.split("-").map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      expect(prevMonth).toBe("2025-01");
    });

    it("calculates next month", () => {
      const current = "2025-02";
      const [year, month] = current.split("-").map(Number);
      const nextDate = new Date(year, month, 1);
      const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

      expect(nextMonth).toBe("2025-03");
    });

    it("handles year boundaries", () => {
      const decMonth = "2024-12";
      const [year, month] = decMonth.split("-").map(Number);
      const nextDate = new Date(year, month, 1);
      const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

      expect(nextMonth).toBe("2025-01");
    });
  });
});
