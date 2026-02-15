import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatRelativeDate,
  formatRelativeTime,
  formatTime,
  formatDateString,
  formatTimeString,
} from "../../../../../lib/db/queries/formatters";

describe("formatters", () => {
  describe("formatRelativeDate", () => {
    it("should return empty string for null", () => {
      expect(formatRelativeDate(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatRelativeDate(undefined)).toBe("");
    });

    it("should return 'Today' for today's date", () => {
      const today = new Date();
      expect(formatRelativeDate(today)).toBe("Today");
    });

    it("should return 'Today' for today's date as string", () => {
      const today = new Date().toISOString();
      expect(formatRelativeDate(today)).toBe("Today");
    });

    it("should return 'Tomorrow' for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatRelativeDate(tomorrow)).toBe("Tomorrow");
    });

    it("should return 'Tomorrow' for tomorrow's date as string", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatRelativeDate(tomorrow.toISOString())).toBe("Tomorrow");
    });

    it("should format past date as 'Mon DD'", () => {
      const pastDate = new Date("2024-01-15");
      const result = formatRelativeDate(pastDate);
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should format future date (not tomorrow) as 'Mon DD'", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const result = formatRelativeDate(futureDate);
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should handle date strings in ISO format", () => {
      const isoDate = "2024-06-15T10:30:00Z";
      const result = formatRelativeDate(isoDate);
      expect(result).toBeTruthy();
    });

    it("should handle date strings in various formats", () => {
      expect(formatRelativeDate("2024-06-15")).toBeTruthy();
      expect(formatRelativeDate("2024/06/15")).toBeTruthy();
    });

    it("should handle different time zones consistently", () => {
      const date = new Date("2024-06-15T00:00:00Z");
      const result = formatRelativeDate(date);
      expect(result).toMatch(/Jun \d+/);
    });

    it("should handle leap year dates", () => {
      const leapDate = new Date("2024-02-29T12:00:00Z");
      const result = formatRelativeDate(leapDate);
      expect(result).toMatch(/Feb (28|29)/); // Allow timezone variance
    });

    it("should handle year boundary dates", () => {
      const newYear = new Date("2024-01-01T12:00:00Z");
      const result = formatRelativeDate(newYear);
      expect(result).toMatch(/(Dec 31|Jan 1)/); // Allow timezone variance
    });

    it("should handle dates at midnight", () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      expect(formatRelativeDate(midnight)).toBe("Today");
    });

    it("should handle dates at end of day", () => {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expect(formatRelativeDate(endOfDay)).toBe("Today");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return empty string for null", () => {
      expect(formatRelativeTime(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatRelativeTime(undefined)).toBe("");
    });

    it("should return 'Just now' for current time", () => {
      const now = new Date();
      vi.setSystemTime(now);
      expect(formatRelativeTime(now)).toBe("Just now");
    });

    it("should return 'Just now' for time less than 1 minute ago", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const thirtySecondsAgo = new Date("2024-01-01T11:59:30Z");
      expect(formatRelativeTime(thirtySecondsAgo)).toBe("Just now");
    });

    it("should return minutes for time less than 1 hour ago", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const thirtyMinsAgo = new Date("2024-01-01T11:30:00Z");
      expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");
    });

    it("should return '1m ago' for exactly 1 minute", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const oneMinAgo = new Date("2024-01-01T11:59:00Z");
      expect(formatRelativeTime(oneMinAgo)).toBe("1m ago");
    });

    it("should return '59m ago' for 59 minutes", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const fiftyNineMinsAgo = new Date("2024-01-01T11:01:00Z");
      expect(formatRelativeTime(fiftyNineMinsAgo)).toBe("59m ago");
    });

    it("should return hours for time less than 24 hours ago", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const threeHoursAgo = new Date("2024-01-01T09:00:00Z");
      expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
    });

    it("should return '1h ago' for exactly 1 hour", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const oneHourAgo = new Date("2024-01-01T11:00:00Z");
      expect(formatRelativeTime(oneHourAgo)).toBe("1h ago");
    });

    it("should return '23h ago' for 23 hours", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const twentyThreeHoursAgo = new Date("2023-12-31T13:00:00Z");
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe("23h ago");
    });

    it("should return days for time less than 7 days ago", () => {
      const now = new Date("2024-01-07T12:00:00Z");
      vi.setSystemTime(now);

      const threeDaysAgo = new Date("2024-01-04T12:00:00Z");
      expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
    });

    it("should return '1d ago' for exactly 1 day", () => {
      const now = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(now);

      const oneDayAgo = new Date("2024-01-01T12:00:00Z");
      expect(formatRelativeTime(oneDayAgo)).toBe("1d ago");
    });

    it("should return '6d ago' for 6 days", () => {
      const now = new Date("2024-01-07T12:00:00Z");
      vi.setSystemTime(now);

      const sixDaysAgo = new Date("2024-01-01T12:00:00Z");
      expect(formatRelativeTime(sixDaysAgo)).toBe("6d ago");
    });

    it("should return formatted date for time 7 days or more ago", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      vi.setSystemTime(now);

      const sevenDaysAgo = new Date("2024-01-08T12:00:00Z");
      const result = formatRelativeTime(sevenDaysAgo);
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it("should handle string dates", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const thirtyMinsAgo = "2024-01-01T11:30:00Z";
      expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");
    });

    it("should handle ISO date strings", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const result = formatRelativeTime("2024-01-01T11:30:00Z");
      expect(result).toBe("30m ago");
    });

    it("should handle future dates (0 minutes)", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      const future = new Date("2024-01-01T12:30:00Z");
      expect(formatRelativeTime(future)).toBe("Just now");
    });
  });

  describe("formatTime", () => {
    it("should return empty string for null", () => {
      expect(formatTime(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatTime(undefined)).toBe("");
    });

    it("should format 00:00 as 12:00 AM", () => {
      expect(formatTime("00:00")).toBe("12:00 AM");
    });

    it("should format 00:30 as 12:30 AM", () => {
      expect(formatTime("00:30")).toBe("12:30 AM");
    });

    it("should format 01:00 as 1:00 AM", () => {
      expect(formatTime("01:00")).toBe("1:00 AM");
    });

    it("should format 11:59 as 11:59 AM", () => {
      expect(formatTime("11:59")).toBe("11:59 AM");
    });

    it("should format 12:00 as 12:00 PM", () => {
      expect(formatTime("12:00")).toBe("12:00 PM");
    });

    it("should format 12:30 as 12:30 PM", () => {
      expect(formatTime("12:30")).toBe("12:30 PM");
    });

    it("should format 13:00 as 1:00 PM", () => {
      expect(formatTime("13:00")).toBe("1:00 PM");
    });

    it("should format 23:59 as 11:59 PM", () => {
      expect(formatTime("23:59")).toBe("11:59 PM");
    });

    it("should format morning times correctly", () => {
      expect(formatTime("06:00")).toBe("6:00 AM");
      expect(formatTime("09:30")).toBe("9:30 AM");
      expect(formatTime("10:45")).toBe("10:45 AM");
    });

    it("should format afternoon times correctly", () => {
      expect(formatTime("14:00")).toBe("2:00 PM");
      expect(formatTime("15:30")).toBe("3:30 PM");
      expect(formatTime("18:45")).toBe("6:45 PM");
    });

    it("should format evening times correctly", () => {
      expect(formatTime("19:00")).toBe("7:00 PM");
      expect(formatTime("20:30")).toBe("8:30 PM");
      expect(formatTime("22:15")).toBe("10:15 PM");
    });

    it("should preserve minutes with leading zero", () => {
      expect(formatTime("09:05")).toBe("9:05 AM");
      expect(formatTime("14:09")).toBe("2:09 PM");
    });

    it("should handle HH:MM:SS format (using first two parts)", () => {
      expect(formatTime("13:45:30")).toBe("1:45 PM");
    });

    it("should handle non-string input by converting to string", () => {
      expect(formatTime("invalid" as any)).toBeTruthy();
    });

    it("should handle edge cases", () => {
      expect(formatTime("00:01")).toBe("12:01 AM");
      expect(formatTime("23:58")).toBe("11:58 PM");
    });
  });

  describe("formatDateString", () => {
    it("should return empty string for null", () => {
      expect(formatDateString(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatDateString(undefined)).toBe("");
    });

    it("should return string date as-is", () => {
      expect(formatDateString("2024-01-15")).toBe("2024-01-15");
    });

    it("should convert Date to ISO date string", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = formatDateString(date);
      expect(result).toMatch(/^2024-01-\d{2}$/);
    });

    it("should handle ISO datetime strings", () => {
      const isoString = "2024-06-15T10:30:00Z";
      expect(formatDateString(isoString)).toBe(isoString);
    });

    it("should handle short date strings", () => {
      expect(formatDateString("2024-01-15")).toBe("2024-01-15");
      expect(formatDateString("2024-12-31")).toBe("2024-12-31");
    });

    it("should handle Date objects at midnight", () => {
      const date = new Date("2024-06-15T00:00:00Z");
      const result = formatDateString(date);
      expect(result).toMatch(/^2024-06-\d{2}$/);
    });

    it("should handle Date objects with time", () => {
      const date = new Date("2024-06-15T15:30:45Z");
      const result = formatDateString(date);
      expect(result).toMatch(/^2024-06-\d{2}$/);
    });

    it("should handle leap year dates", () => {
      const leapDate = new Date("2024-02-29T00:00:00Z");
      const result = formatDateString(leapDate);
      expect(result).toContain("2024-02-29");
    });

    it("should handle year boundary dates", () => {
      const newYear = new Date("2024-01-01T00:00:00Z");
      const result = formatDateString(newYear);
      expect(result).toContain("2024-01-01");
    });

    it("should handle end of year dates", () => {
      const endYear = new Date("2024-12-31T23:59:59Z");
      const result = formatDateString(endYear);
      expect(result).toMatch(/^2024-12-\d{2}$/);
    });

    it("should convert non-date/non-string to string", () => {
      const result = formatDateString(12345 as any);
      expect(result).toBe("12345");
    });
  });

  describe("formatTimeString", () => {
    it("should return empty string for null", () => {
      expect(formatTimeString(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatTimeString(undefined)).toBe("");
    });

    it("should return string time as-is", () => {
      expect(formatTimeString("10:30")).toBe("10:30");
    });

    it("should handle HH:MM format", () => {
      expect(formatTimeString("14:45")).toBe("14:45");
      expect(formatTimeString("00:00")).toBe("00:00");
      expect(formatTimeString("23:59")).toBe("23:59");
    });

    it("should handle HH:MM:SS format", () => {
      expect(formatTimeString("10:30:45")).toBe("10:30:45");
      expect(formatTimeString("00:00:00")).toBe("00:00:00");
    });

    it("should handle time with leading zeros", () => {
      expect(formatTimeString("09:05")).toBe("09:05");
      expect(formatTimeString("01:01")).toBe("01:01");
    });

    it("should handle midnight", () => {
      expect(formatTimeString("00:00")).toBe("00:00");
    });

    it("should handle end of day", () => {
      expect(formatTimeString("23:59")).toBe("23:59");
    });

    it("should convert non-string to string", () => {
      const result = formatTimeString(1234 as any);
      expect(result).toBe("1234");
    });

    it("should handle various valid time formats", () => {
      const times = [
        "00:00",
        "06:30",
        "12:00",
        "18:45",
        "23:59",
      ];

      for (const time of times) {
        expect(formatTimeString(time)).toBe(time);
      }
    });
  });
});
