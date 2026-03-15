/**
 * Unit tests for trips.server.ts
 *
 * Database-dependent functions (getTrips, getTripById, etc.) are tested via
 * integration tests. This file covers behaviour that does not require a live DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the drizzle db import so the module can be imported without a live DB
vi.mock("../../../../../lib/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{}]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/logger", () => ({
  dbLogger: { error: vi.fn() },
}));

vi.mock("../../../../../lib/db/queries/reports.server", () => ({
  getOrganizationById: vi.fn().mockResolvedValue({ timezone: "UTC" }),
}));

vi.mock("../../../../../lib/db/queries/bookings.server", () => ({
  getBookings: vi.fn().mockResolvedValue({ bookings: [] }),
}));

vi.mock("../../../../../lib/db/queries/tours.server", () => ({
  getTourById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../../lib/db/queries/boats.server", () => ({
  getBoatById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../../lib/db/queries/dive-sites.server", () => ({
  getDiveSitesForTour: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../../lib/integrations/google-calendar.server", () => ({
  syncTripToCalendar: vi.fn().mockResolvedValue(undefined),
}));

import { mapTrip } from "../../../../../lib/db/queries/mappers";

describe("trips.server.ts", () => {
  describe("requiresTankSelection propagated through mapTrip", () => {
    const baseRow = {
      id: "trip-1",
      organizationId: "org-1",
      tourId: "tour-1",
      boatId: null,
      date: "2026-06-01",
      startTime: "09:00",
      endTime: null,
      status: "scheduled",
      maxParticipants: null,
      price: null,
      notes: null,
      weatherNotes: null,
      isPublic: false,
      isRecurring: false,
      recurrencePattern: null,
      recurringTemplateId: null,
      recurrenceDays: null,
      recurrenceEndDate: null,
      recurrenceCount: null,
      staffIds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("maps requiresTankSelection = true from joined tour data", () => {
      const result = mapTrip({
        ...baseRow,
        requires_tank_selection: true,
        tour_name: "Test Tour",
        tour_type: "dive",
        tour_price: null,
        booked_participants: 0,
      });

      expect(result.requiresTankSelection).toBe(true);
    });

    it("maps requiresTankSelection = false when tour does not require it", () => {
      const result = mapTrip({
        ...baseRow,
        requires_tank_selection: false,
        tour_name: "Standard Tour",
        tour_type: "dive",
        tour_price: null,
        booked_participants: 0,
      });

      expect(result.requiresTankSelection).toBe(false);
    });

    it("defaults requiresTankSelection to false when not provided", () => {
      const result = mapTrip({
        ...baseRow,
        tour_name: "No Tank Field Tour",
        tour_type: "dive",
        tour_price: null,
        booked_participants: 0,
      });

      expect(result.requiresTankSelection).toBe(false);
    });

    it("maps requiresTankSelection from camelCase field", () => {
      const result = mapTrip({
        ...baseRow,
        requiresTankSelection: true,
        tour_name: "CamelCase Tour",
        tour_type: "dive",
        tour_price: null,
        booked_participants: 0,
      });

      expect(result.requiresTankSelection).toBe(true);
    });
  });
});
