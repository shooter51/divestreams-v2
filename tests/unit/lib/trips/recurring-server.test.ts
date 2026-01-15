/**
 * Recurring Trip Server Tests
 *
 * Tests for recurring trip calculation and generation functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockReturning = vi.fn().mockResolvedValue([{ id: "trip-1" }]);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);

vi.mock("../../../../lib/db", () => ({
  db: {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
    orderBy: mockOrderBy,
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    boatId: "boatId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    price: "price",
    notes: "notes",
    staffIds: "staffIds",
    weatherNotes: "weatherNotes",
    isRecurring: "isRecurring",
    recurrencePattern: "recurrencePattern",
    recurrenceDays: "recurrenceDays",
    recurrenceEndDate: "recurrenceEndDate",
    recurrenceCount: "recurrenceCount",
    recurringTemplateId: "recurringTemplateId",
    recurrenceIndex: "recurrenceIndex",
    status: "status",
  },
}));

describe("Recurring Trip Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "trip-1" }]);
    mockOrderBy.mockResolvedValue([]);
  });

  describe("Module exports", () => {
    it("exports calculateOccurrences function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.calculateOccurrences).toBe("function");
    });

    it("exports createRecurringTrip function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.createRecurringTrip).toBe("function");
    });

    it("exports generateTripsFromRecurrence function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.generateTripsFromRecurrence).toBe("function");
    });

    it("exports getNextOccurrences function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.getNextOccurrences).toBe("function");
    });

    it("exports updateRecurringTrip function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.updateRecurringTrip).toBe("function");
    });

    it("exports cancelRecurringSeries function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.cancelRecurringSeries).toBe("function");
    });

    it("exports getRecurringSeriesInstances function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.getRecurringSeriesInstances).toBe("function");
    });

    it("exports getRecurringTemplate function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.getRecurringTemplate).toBe("function");
    });

    it("exports previewRecurrenceDates function", async () => {
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(typeof recurringModule.previewRecurrenceDates).toBe("function");
    });
  });

  describe("calculateOccurrences", () => {
    it("generates daily occurrences", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "daily", {
        maxCount: 5,
        generateUntil: "2024-01-31",
      });

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0].date).toBe("2024-01-01");
      expect(occurrences[1].date).toBe("2024-01-02");
      expect(occurrences[2].date).toBe("2024-01-03");
      expect(occurrences[3].date).toBe("2024-01-04");
      expect(occurrences[4].date).toBe("2024-01-05");
    });

    it("generates weekly occurrences on same day", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "weekly", {
        maxCount: 4,
        generateUntil: "2024-02-28",
      });

      expect(occurrences).toHaveLength(4);
      expect(occurrences[0].date).toBe("2024-01-01");
      expect(occurrences[1].date).toBe("2024-01-08");
      expect(occurrences[2].date).toBe("2024-01-15");
      expect(occurrences[3].date).toBe("2024-01-22");
    });

    it("generates biweekly occurrences", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "biweekly", {
        maxCount: 3,
        generateUntil: "2024-03-31",
      });

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0].date).toBe("2024-01-01");
      expect(occurrences[1].date).toBe("2024-01-15");
      expect(occurrences[2].date).toBe("2024-01-29");
    });

    it("generates monthly occurrences", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-15", "monthly", {
        maxCount: 4,
        generateUntil: "2024-12-31",
      });

      expect(occurrences).toHaveLength(4);
      expect(occurrences[0].date).toBe("2024-01-15");
      expect(occurrences[1].date).toBe("2024-02-15");
      expect(occurrences[2].date).toBe("2024-03-15");
      expect(occurrences[3].date).toBe("2024-04-15");
    });

    it("respects endDate constraint", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "daily", {
        endDate: "2024-01-03",
        maxCount: 100,
        generateUntil: "2024-12-31",
      });

      expect(occurrences.length).toBeLessThanOrEqual(3);
    });

    it("respects maxCount constraint", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "daily", {
        maxCount: 3,
        generateUntil: "2024-12-31",
      });

      expect(occurrences).toHaveLength(3);
    });

    it("generates weekly occurrences on specific days", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      // Monday = 1, Wednesday = 3, Friday = 5
      const occurrences = calculateOccurrences("2024-01-01", "weekly", {
        recurrenceDays: [1, 3, 5],
        maxCount: 6,
        generateUntil: "2024-01-31",
      });

      expect(occurrences.length).toBeGreaterThan(0);

      // All occurrences should be on Mon, Wed, or Fri
      for (const occ of occurrences) {
        const dayOfWeek = new Date(occ.date + "T00:00:00").getDay();
        expect([1, 3, 5]).toContain(dayOfWeek);
      }
    });

    it("assigns sequential indices", async () => {
      const { calculateOccurrences } = await import("../../../../lib/trips/recurring.server");

      const occurrences = calculateOccurrences("2024-01-01", "daily", {
        maxCount: 5,
        generateUntil: "2024-01-31",
      });

      expect(occurrences[0].index).toBe(0);
      expect(occurrences[1].index).toBe(1);
      expect(occurrences[2].index).toBe(2);
      expect(occurrences[3].index).toBe(3);
      expect(occurrences[4].index).toBe(4);
    });
  });

  describe("previewRecurrenceDates", () => {
    it("returns array of date strings", async () => {
      const { previewRecurrenceDates } = await import("../../../../lib/trips/recurring.server");

      const dates = previewRecurrenceDates("2024-01-01", "weekly", {
        maxCount: 4,
      });

      expect(Array.isArray(dates)).toBe(true);
      expect(dates).toHaveLength(4);
      expect(dates[0]).toBe("2024-01-01");
    });

    it("defaults to 12 preview dates", async () => {
      const { previewRecurrenceDates } = await import("../../../../lib/trips/recurring.server");

      const dates = previewRecurrenceDates("2024-01-01", "weekly", {});

      expect(dates.length).toBeLessThanOrEqual(12);
    });

    it("respects maxCount option", async () => {
      const { previewRecurrenceDates } = await import("../../../../lib/trips/recurring.server");

      const dates = previewRecurrenceDates("2024-01-01", "daily", {
        maxCount: 5,
      });

      expect(dates).toHaveLength(5);
    });
  });

  describe("RecurrencePattern type", () => {
    it("exports RecurrencePattern type", async () => {
      // Type exports don't have runtime presence
      const recurringModule = await import("../../../../lib/trips/recurring.server");
      expect(recurringModule).toBeDefined();
    });
  });
});
