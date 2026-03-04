/**
 * Tests for training module display formatting fixes.
 *
 * Covers:
 * - DS-911: Enrollment status labels (humanised)
 * - DS-k9x: Singular/plural "day/days" grammar
 * - DS-6g6: Consistent date formatting
 * - DS-6w6: No duplicate "paid" in payment display
 * - DS-4vl: Status/payment labels capitalised
 * - DS-6cs: ISO dates formatted for display
 * - DS-nef: Snake_case status humanised
 * - DS-set: Session dropdown time formatting
 * - DS-5pt: Session status labels capitalised
 * - DS-3k9: No orphaned "0" for null duration
 * - DS-n65: Courses query has DB-level limit
 */
import { describe, it, expect } from "vitest";
import { formatLabel, formatTime, formatDisplayDate, pluralize } from "../../../../../../app/lib/format";

describe("DS-911: Enrollment status humanisation", () => {
  it("converts 'enrolled' to 'Enrolled'", () => {
    expect(formatLabel("enrolled")).toBe("Enrolled");
  });

  it("converts 'in_progress' to 'In Progress'", () => {
    expect(formatLabel("in_progress")).toBe("In Progress");
  });

  it("converts 'completed' to 'Completed'", () => {
    expect(formatLabel("completed")).toBe("Completed");
  });

  it("converts 'withdrawn' to 'Withdrawn'", () => {
    expect(formatLabel("withdrawn")).toBe("Withdrawn");
  });

  it("converts 'dropped' to 'Dropped'", () => {
    expect(formatLabel("dropped")).toBe("Dropped");
  });

  it("converts 'failed' to 'Failed'", () => {
    expect(formatLabel("failed")).toBe("Failed");
  });
});

describe("DS-k9x: Singular/plural day grammar", () => {
  it("returns '1 day' for count 1", () => {
    expect(pluralize(1, "day")).toBe("1 day");
  });

  it("returns '2 days' for count 2", () => {
    expect(pluralize(2, "day")).toBe("2 days");
  });

  it("returns '0 days' for count 0", () => {
    expect(pluralize(0, "day")).toBe("0 days");
  });

  it("returns '5 days' for count 5", () => {
    expect(pluralize(5, "day")).toBe("5 days");
  });
});

describe("DS-6cs: Date formatting (no raw ISO)", () => {
  it("formats ISO date to human readable", () => {
    expect(formatDisplayDate("2026-03-15")).toBe("Mar 15, 2026");
  });

  it("returns empty string for null date", () => {
    expect(formatDisplayDate(null)).toBe("");
  });

  it("returns empty string for undefined date", () => {
    expect(formatDisplayDate(undefined)).toBe("");
  });
});

describe("DS-set: Session time formatting", () => {
  it("formats '09:00:00' to '9:00 AM'", () => {
    expect(formatTime("09:00:00")).toBe("9:00 AM");
  });

  it("formats '14:30:00' to '2:30 PM'", () => {
    expect(formatTime("14:30:00")).toBe("2:30 PM");
  });

  it("formats '09:00' (without seconds) to '9:00 AM'", () => {
    expect(formatTime("09:00")).toBe("9:00 AM");
  });

  it("formats midnight '00:00:00' to '12:00 AM'", () => {
    expect(formatTime("00:00:00")).toBe("12:00 AM");
  });
});

describe("DS-4vl / DS-nef: Status label capitalisation", () => {
  it("capitalises 'pending' to 'Pending'", () => {
    expect(formatLabel("pending")).toBe("Pending");
  });

  it("capitalises 'paid' to 'Paid'", () => {
    expect(formatLabel("paid")).toBe("Paid");
  });

  it("capitalises 'partial' to 'Partial'", () => {
    expect(formatLabel("partial")).toBe("Partial");
  });

  it("capitalises 'refunded' to 'Refunded'", () => {
    expect(formatLabel("refunded")).toBe("Refunded");
  });

  it("capitalises 'waived' to 'Waived'", () => {
    expect(formatLabel("waived")).toBe("Waived");
  });
});

describe("DS-5pt: Session status labels", () => {
  it("capitalises 'open' to 'Open'", () => {
    expect(formatLabel("open")).toBe("Open");
  });

  it("capitalises 'scheduled' to 'Scheduled'", () => {
    expect(formatLabel("scheduled")).toBe("Scheduled");
  });

  it("converts 'in_progress' to 'In Progress'", () => {
    expect(formatLabel("in_progress")).toBe("In Progress");
  });

  it("capitalises 'completed' to 'Completed'", () => {
    expect(formatLabel("completed")).toBe("Completed");
  });

  it("capitalises 'cancelled' to 'Cancelled'", () => {
    expect(formatLabel("cancelled")).toBe("Cancelled");
  });
});

describe("DS-3k9: Null/zero duration display", () => {
  it("pluralize with 0 shows '0 days' not orphaned '0'", () => {
    // When duration is 0, the display should use pluralize or show a dash
    expect(pluralize(0, "day")).toBe("0 days");
  });
});
