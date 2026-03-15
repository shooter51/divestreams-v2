/**
 * DS-yxov: getNextBookingNumber SQL error "negative substring length not allowed"
 *
 * Root cause: The original ORDER BY used SUBSTRING/POSITION which fails when
 * a booking_number doesn't have a second '-' after position 4 (e.g. "BK-1A"
 * or "BK-1000" without a suffix). The fix replaces it with regexp_match which
 * safely returns NULL for non-matching rows.
 *
 * These tests verify the function handles edge-case booking number formats
 * gracefully when the DB returns them (e.g. after the ORDER BY change).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db — same pattern as DS-ktz5-booking-numbers.test.ts
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const dbMock = {
  select: mockSelect,
};

vi.mock("../../../../lib/db/index", () => ({
  db: dbMock,
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ type: "and", args })),
  eq: vi.fn((col, val) => ({ type: "eq", col, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  desc: vi.fn((col) => ({ type: "desc", col })),
}));

const BOOKING_PATTERN = /^BK-\d+-[A-Z0-9]{4}$/;

describe("DS-yxov: getNextBookingNumber handles non-standard booking number formats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles normal BK-NNNN-XXXX format correctly", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1005-A3KP" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1006-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("handles old format without suffix (BK-1000) gracefully", async () => {
    // Simulates a booking created before the -XXXX suffix was added.
    // The function receives this as the top result from the DB after the
    // ORDER BY is applied. It should parse the number part and increment.
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1000" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    // Should extract "1000" and produce BK-1001-XXXX
    expect(result).toMatch(/^BK-1001-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when DB returns booking with non-numeric after BK- (BK-ABC)", async () => {
    // This format doesn't match ^BK-(\d+) so match returns null → fallback
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-ABC" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when DB returns mixed format (BK-1A-XYZ)", async () => {
    // "BK-1A-XYZ" starts with a digit but doesn't have pure digits.
    // The regex ^BK-(\d+) would match "1" only up to the 'A',
    // or not match at all depending on implementation.
    // Either way the function should produce a valid booking number.
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1A-XYZ" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    // Result must be a valid BK-NNNN-XXXX booking number
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when no bookings exist", async () => {
    mockLimit.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when result is null", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("uses regexp_match-style ORDER BY in the SQL query (not fragile SUBSTRING/POSITION)", async () => {
    mockLimit.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    await getNextBookingNumber("org-1");

    // Verify the orderBy call was made with an sql template containing regexp_match
    expect(mockOrderBy).toHaveBeenCalledOnce();
    const orderByArg = mockOrderBy.mock.calls[0][0];

    // The sql mock returns { type: "sql", strings, values }
    // Check that the SQL strings array contains regexp_match (not SUBSTRING)
    const sqlStrings = orderByArg?.strings ?? [];
    const sqlText = Array.isArray(sqlStrings) ? sqlStrings.join("") : String(sqlStrings);

    expect(sqlText).toContain("regexp_match");
    expect(sqlText).not.toContain("SUBSTRING");
    expect(sqlText).not.toContain("POSITION");
  });
});
