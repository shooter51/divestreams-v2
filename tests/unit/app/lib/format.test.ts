import { describe, it, expect } from "vitest";
import {
  formatTime,
  formatDisplayDate,
  formatCurrency,
  formatLabel,
  formatCapacity,
} from "../../../../app/lib/format";

describe("formatDisplayDate", () => {
  it("returns empty string for null", () => {
    expect(formatDisplayDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDisplayDate(undefined)).toBe("");
  });

  it("formats YYYY-MM-DD to human-readable date", () => {
    expect(formatDisplayDate("2026-03-04")).toBe("Mar 4, 2026");
  });

  it("formats single-digit day correctly", () => {
    expect(formatDisplayDate("2026-02-07")).toBe("Feb 7, 2026");
  });

  it("formats year correctly", () => {
    expect(formatDisplayDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("formats December correctly", () => {
    expect(formatDisplayDate("2025-12-25")).toBe("Dec 25, 2025");
  });

  it("does not shift date due to timezone (appends T00:00:00)", () => {
    // '2026-03-04' should always be Mar 4, never Mar 3 due to UTC offset
    const result = formatDisplayDate("2026-03-04");
    expect(result).toBe("Mar 4, 2026");
  });
});

describe("formatTime", () => {
  it("returns empty string for null", () => {
    expect(formatTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatTime(undefined)).toBe("");
  });

  it("formats HH:MM:SS to 12-hour time", () => {
    expect(formatTime("09:00:00")).toBe("9:00 AM");
  });

  it("formats noon correctly", () => {
    expect(formatTime("12:00:00")).toBe("12:00 PM");
  });

  it("formats midnight correctly", () => {
    expect(formatTime("00:00:00")).toBe("12:00 AM");
  });

  it("formats afternoon correctly", () => {
    expect(formatTime("14:30:00")).toBe("2:30 PM");
  });

  it("formats HH:MM (without seconds)", () => {
    expect(formatTime("08:30")).toBe("8:30 AM");
  });
});
