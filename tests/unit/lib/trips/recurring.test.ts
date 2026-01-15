/**
 * Recurring Trips Tests
 *
 * Tests for recurring trip date calculation and preview functions.
 * These test the pure functions that don't require database access.
 */

import { describe, it, expect } from "vitest";
import {
  calculateOccurrences,
  previewRecurrenceDates,
  type RecurrencePattern,
} from "../../../../lib/trips/recurring.server";

describe("recurring.server", () => {
  // ============================================================================
  // calculateOccurrences Tests
  // ============================================================================
  describe("calculateOccurrences", () => {
    describe("daily pattern", () => {
      it("generates daily occurrences", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          maxCount: 5,
        });

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0].date).toBe("2025-01-01");
        expect(occurrences[1].date).toBe("2025-01-02");
        expect(occurrences[2].date).toBe("2025-01-03");
        expect(occurrences[3].date).toBe("2025-01-04");
        expect(occurrences[4].date).toBe("2025-01-05");
      });

      it("respects end date", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          endDate: "2025-01-03",
          maxCount: 100,
        });

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0].date).toBe("2025-01-01");
        expect(occurrences[1].date).toBe("2025-01-02");
        expect(occurrences[2].date).toBe("2025-01-03");
      });

      it("respects max count", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          maxCount: 3,
        });

        expect(occurrences).toHaveLength(3);
      });

      it("assigns sequential indices", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          maxCount: 3,
        });

        expect(occurrences[0].index).toBe(0);
        expect(occurrences[1].index).toBe(1);
        expect(occurrences[2].index).toBe(2);
      });
    });

    describe("weekly pattern", () => {
      it("generates weekly occurrences on same day", () => {
        const occurrences = calculateOccurrences("2025-01-06", "weekly", {
          maxCount: 4,
        });

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0].date).toBe("2025-01-06"); // Monday
        expect(occurrences[1].date).toBe("2025-01-13"); // Monday
        expect(occurrences[2].date).toBe("2025-01-20"); // Monday
        expect(occurrences[3].date).toBe("2025-01-27"); // Monday
      });

      it("generates occurrences on specific days of week", () => {
        // Starting Monday Jan 6, want Tuesday (2) and Thursday (4)
        const occurrences = calculateOccurrences("2025-01-06", "weekly", {
          recurrenceDays: [2, 4], // Tuesday, Thursday
          maxCount: 4,
          generateUntil: "2025-01-20",
        });

        // Should get: Jan 7 (Tue), Jan 9 (Thu), Jan 14 (Tue), Jan 16 (Thu)
        expect(occurrences.length).toBeGreaterThanOrEqual(2);
        // All occurrences should be on Tuesday or Thursday
        occurrences.forEach((occ) => {
          const dayOfWeek = new Date(occ.date + "T00:00:00").getDay();
          expect([2, 4]).toContain(dayOfWeek);
        });
      });

      it("handles Saturday and Sunday recurrence days", () => {
        // Start on a Friday, want Sat (6) and Sun (0)
        const occurrences = calculateOccurrences("2025-01-03", "weekly", {
          recurrenceDays: [0, 6], // Sunday, Saturday
          maxCount: 4,
          generateUntil: "2025-01-20",
        });

        occurrences.forEach((occ) => {
          const dayOfWeek = new Date(occ.date + "T00:00:00").getDay();
          expect([0, 6]).toContain(dayOfWeek);
        });
      });
    });

    describe("biweekly pattern", () => {
      it("generates biweekly occurrences", () => {
        const occurrences = calculateOccurrences("2025-01-06", "biweekly", {
          maxCount: 3,
        });

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0].date).toBe("2025-01-06");
        expect(occurrences[1].date).toBe("2025-01-20");
        expect(occurrences[2].date).toBe("2025-02-03");
      });

      it("handles biweekly with specific days", () => {
        const occurrences = calculateOccurrences("2025-01-06", "biweekly", {
          recurrenceDays: [1, 3], // Monday, Wednesday
          maxCount: 8,
          generateUntil: "2025-02-28",
        });

        // Should skip every other week
        expect(occurrences.length).toBeGreaterThan(0);
      });
    });

    describe("monthly pattern", () => {
      it("generates monthly occurrences on same day", () => {
        const occurrences = calculateOccurrences("2025-01-15", "monthly", {
          maxCount: 4,
        });

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0].date).toBe("2025-01-15");
        expect(occurrences[1].date).toBe("2025-02-15");
        expect(occurrences[2].date).toBe("2025-03-15");
        expect(occurrences[3].date).toBe("2025-04-15");
      });

      it("handles end of month correctly", () => {
        const occurrences = calculateOccurrences("2025-01-31", "monthly", {
          maxCount: 4,
        });

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0].date).toBe("2025-01-31");
        // February may adjust to end of month
        expect(occurrences[1].date).toMatch(/^2025-0(2-28|3-03)/); // Feb 28 or Mar 3
        expect(occurrences[2].date).toMatch(/^2025-0(3|4)/);
        expect(occurrences[3].date).toMatch(/^2025-0(4|5)/);
      });

      it("handles leap year February", () => {
        // 2024 is a leap year, 2028 is also
        const occurrences = calculateOccurrences("2024-01-29", "monthly", {
          maxCount: 3,
        });

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0].date).toBe("2024-01-29");
        expect(occurrences[1].date).toBe("2024-02-29"); // Leap year!
        expect(occurrences[2].date).toBe("2024-03-29");
      });
    });

    describe("edge cases", () => {
      it("returns empty array when start date is after end date", () => {
        const occurrences = calculateOccurrences("2025-01-10", "daily", {
          endDate: "2025-01-05",
        });

        expect(occurrences).toHaveLength(0);
      });

      it("handles generateUntil parameter", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          generateUntil: "2025-01-03",
        });

        expect(occurrences).toHaveLength(3);
        expect(occurrences[2].date).toBe("2025-01-03");
      });

      it("defaults to safety limit of 100", () => {
        const occurrences = calculateOccurrences("2025-01-01", "daily", {
          endDate: "2025-12-31",
        });

        expect(occurrences.length).toBeLessThanOrEqual(100);
      });

      it("handles empty recurrence days array for weekly", () => {
        const occurrences = calculateOccurrences("2025-01-06", "weekly", {
          recurrenceDays: [],
          maxCount: 3,
        });

        // Should fall back to same-day-of-week behavior
        expect(occurrences.length).toBe(3);
      });
    });
  });

  // ============================================================================
  // previewRecurrenceDates Tests
  // ============================================================================
  describe("previewRecurrenceDates", () => {
    it("returns array of date strings", () => {
      const dates = previewRecurrenceDates("2025-01-01", "daily", {
        maxCount: 5,
      });

      expect(dates).toHaveLength(5);
      expect(typeof dates[0]).toBe("string");
      expect(dates[0]).toBe("2025-01-01");
    });

    it("defaults to 12 preview dates", () => {
      const dates = previewRecurrenceDates("2025-01-01", "weekly", {});

      expect(dates.length).toBeLessThanOrEqual(12);
    });

    it("respects maxCount for preview", () => {
      const dates = previewRecurrenceDates("2025-01-01", "daily", {
        maxCount: 5,
      });

      expect(dates).toHaveLength(5);
    });

    it("respects endDate for preview", () => {
      const dates = previewRecurrenceDates("2025-01-01", "daily", {
        endDate: "2025-01-03",
      });

      expect(dates).toHaveLength(3);
      expect(dates).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    });

    it("previews weekly pattern with specific days", () => {
      const dates = previewRecurrenceDates("2025-01-06", "weekly", {
        recurrenceDays: [1], // Monday only
        maxCount: 4,
      });

      expect(dates).toHaveLength(4);
      // All should be Mondays
      dates.forEach((date) => {
        const dayOfWeek = new Date(date + "T00:00:00").getDay();
        expect(dayOfWeek).toBe(1);
      });
    });

    it("previews monthly pattern", () => {
      const dates = previewRecurrenceDates("2025-01-15", "monthly", {
        maxCount: 6,
      });

      expect(dates).toHaveLength(6);
      expect(dates[0]).toBe("2025-01-15");
      expect(dates[1]).toBe("2025-02-15");
      expect(dates[2]).toBe("2025-03-15");
    });

    it("handles various recurrence patterns", () => {
      const patterns: RecurrencePattern[] = ["daily", "weekly", "biweekly", "monthly"];

      patterns.forEach((pattern) => {
        const dates = previewRecurrenceDates("2025-01-01", pattern, {
          maxCount: 3,
        });
        expect(dates.length).toBeGreaterThan(0);
        expect(dates[0]).toBe("2025-01-01");
      });
    });
  });
});
