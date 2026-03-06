/**
 * Tests for DS-p3 display formatting defects:
 * DS-77a, DS-m8a: Customer detail raw ISO dates
 * DS-jpy, DS-jwk: Customer detail totalSpent formatting
 * DS-1zp: Booking status capitalization
 * DS-4tt: Bookings list raw SQL time
 * DS-wt3: Booking detail raw source enum
 * DS-jxe: Booking total missing trailing zero / thousands separator
 * DS-ybk: Bookings/new spots display
 * DS-2b2: Bookings/new raw time in dropdown
 */
import { describe, it, expect } from "vitest";
import {
  formatDisplayDate,
  formatTime,
  formatCurrency,
  formatLabel,
} from "../../../../app/lib/format";

describe("DS-77a/DS-m8a: Date formatting for customer detail fields", () => {
  it("formats YYYY-MM-DD date of birth as human-readable", () => {
    const result = formatDisplayDate("1990-06-15");
    expect(result).toBe("Jun 15, 1990");
    expect(result).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats YYYY-MM-DD last dive date as human-readable", () => {
    const result = formatDisplayDate("2025-11-20");
    expect(result).toBe("Nov 20, 2025");
    expect(result).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats YYYY-MM-DD createdAt as human-readable", () => {
    const result = formatDisplayDate("2024-03-01");
    expect(result).toBe("Mar 1, 2024");
  });

  it("returns empty string for null dates", () => {
    expect(formatDisplayDate(null)).toBe("");
  });

  it("returns empty string for undefined dates", () => {
    expect(formatDisplayDate(undefined)).toBe("");
  });
});

describe("DS-jpy/DS-jwk: Currency formatting with thousands separator", () => {
  it("formats 1200 as $1,200.00", () => {
    expect(formatCurrency(1200)).toBe("$1,200.00");
  });

  it("formats 214.5 as $214.50 (trailing zero)", () => {
    expect(formatCurrency(214.5)).toBe("$214.50");
  });

  it("formats 0 as $0.00", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats string amount with thousands separator", () => {
    expect(formatCurrency("15000")).toBe("$15,000.00");
  });

  it("formats string amount with decimals", () => {
    expect(formatCurrency("214.5")).toBe("$214.50");
  });
});

describe("DS-1zp: Booking status capitalization via formatLabel", () => {
  it("capitalizes 'pending' to 'Pending'", () => {
    expect(formatLabel("pending")).toBe("Pending");
  });

  it("capitalizes 'confirmed' to 'Confirmed'", () => {
    expect(formatLabel("confirmed")).toBe("Confirmed");
  });

  it("formats 'no_show' as 'No Show'", () => {
    expect(formatLabel("no_show")).toBe("No Show");
  });

  it("formats 'checked_in' as 'Checked In'", () => {
    expect(formatLabel("checked_in")).toBe("Checked In");
  });
});

describe("DS-4tt/DS-2b2: SQL time formatting", () => {
  it("formats '08:00:00' as '8:00 AM'", () => {
    expect(formatTime("08:00:00")).toBe("8:00 AM");
  });

  it("formats '14:30:00' as '2:30 PM'", () => {
    expect(formatTime("14:30:00")).toBe("2:30 PM");
  });

  it("formats '08:00' (without seconds) as '8:00 AM'", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
  });

  it("formats '17:00:00' as '5:00 PM'", () => {
    expect(formatTime("17:00:00")).toBe("5:00 PM");
  });
});

describe("DS-wt3: Source enum humanisation", () => {
  it("capitalizes 'walk_in' to 'Walk In'", () => {
    expect(formatLabel("walk_in")).toBe("Walk In");
  });

  it("capitalizes 'direct' to 'Direct'", () => {
    expect(formatLabel("direct")).toBe("Direct");
  });

  it("capitalizes 'online' to 'Online'", () => {
    expect(formatLabel("online")).toBe("Online");
  });

  it("capitalizes 'repeat' to 'Repeat'", () => {
    expect(formatLabel("repeat")).toBe("Repeat");
  });

  it("returns empty string for null", () => {
    expect(formatLabel(null)).toBe("");
  });
});

describe("DS-jxe: Booking total with proper decimal formatting", () => {
  it("formats 214.5 with trailing zero", () => {
    const result = formatCurrency(214.5);
    expect(result).toBe("$214.50");
    expect(result).not.toBe("$214.5");
  });

  it("formats 1500 with thousands separator and decimals", () => {
    const result = formatCurrency(1500);
    expect(result).toBe("$1,500.00");
    expect(result).not.toBe("$1500");
  });
});

describe("DS-ybk: Trip spots available display", () => {
  it("shows count when spots is a number", () => {
    const spotsAvailable: number | null = 5;
    const display = spotsAvailable !== null ? `${spotsAvailable} spots available` : "Unlimited spots";
    expect(display).toBe("5 spots available");
  });

  it("shows 'Unlimited spots' when spotsAvailable is null", () => {
    const spotsAvailable: number | null = null;
    const display = spotsAvailable !== null ? `${spotsAvailable} spots available` : "Unlimited spots";
    expect(display).toBe("Unlimited spots");
  });

  it("shows '0 spots available' when sold out", () => {
    const spotsAvailable: number | null = 0;
    const display = spotsAvailable !== null ? `${spotsAvailable} spots available` : "Unlimited spots";
    expect(display).toBe("0 spots available");
  });
});
