/**
 * Tests for app/lib/format.ts utility functions
 *
 * DS-cal8: Training session time shows raw "09:00:00" instead of "9:00 AM"
 */

import { describe, it, expect } from "vitest";
import { formatTime, formatCurrency, formatLabel } from "../../../../app/lib/format";

describe("formatTime", () => {
  // DS-cal8: verify raw HH:MM:SS times are formatted to 12-hour AM/PM
  it("converts 09:00:00 to 9:00 AM", () => {
    expect(formatTime("09:00:00")).toBe("9:00 AM");
  });

  it("converts 13:30:00 to 1:30 PM", () => {
    expect(formatTime("13:30:00")).toBe("1:30 PM");
  });

  it("converts 00:00:00 to 12:00 AM (midnight)", () => {
    expect(formatTime("00:00:00")).toBe("12:00 AM");
  });

  it("converts 12:00:00 to 12:00 PM (noon)", () => {
    expect(formatTime("12:00:00")).toBe("12:00 PM");
  });

  it("converts HH:MM (no seconds) correctly", () => {
    expect(formatTime("08:30")).toBe("8:30 AM");
  });

  it("returns empty string for null", () => {
    expect(formatTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatTime(undefined)).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats positive number to USD", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("formats string number to USD", () => {
    expect(formatCurrency("50.5")).toBe("$50.50");
  });

  it("returns $0.00 for null", () => {
    expect(formatCurrency(null)).toBe("$0.00");
  });
});

describe("formatLabel", () => {
  it("converts snake_case to Title Case", () => {
    expect(formatLabel("in_progress")).toBe("In Progress");
  });

  it("returns empty string for null", () => {
    expect(formatLabel(null)).toBe("");
  });
});
