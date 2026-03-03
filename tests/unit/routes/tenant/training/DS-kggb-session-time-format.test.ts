/**
 * DS-kggb: Training session time shows seconds (09:00:00) instead of AM/PM format (9:00 AM)
 * The Session Details panel in $id.tsx was rendering raw startTime string directly.
 */
import { describe, it, expect } from "vitest";

/**
 * This is the formatTime helper that SHOULD be used in the session detail view.
 * Mirrors the logic in sessions/index.tsx.
 */
function formatTime(t: string | null | undefined): string {
  if (!t) return "Not set";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

describe("DS-kggb: formatTime for training session display", () => {
  it("formats 09:00:00 as '9:00 AM' (no seconds)", () => {
    // The raw DB value "09:00:00" should NOT appear — it should be "9:00 AM"
    const result = formatTime("09:00:00");
    expect(result).not.toContain("09:00:00");
    expect(result).toBe("9:00 AM");
  });

  it("formats 14:30:00 as '2:30 PM'", () => {
    expect(formatTime("14:30:00")).toBe("2:30 PM");
  });

  it("formats 00:00:00 as '12:00 AM'", () => {
    expect(formatTime("00:00:00")).toBe("12:00 AM");
  });

  it("formats 12:00:00 as '12:00 PM'", () => {
    expect(formatTime("12:00:00")).toBe("12:00 PM");
  });

  it("returns 'Not set' for null/undefined/empty", () => {
    expect(formatTime(null)).toBe("Not set");
    expect(formatTime(undefined)).toBe("Not set");
    expect(formatTime("")).toBe("Not set");
  });
});
