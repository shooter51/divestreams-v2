/**
 * Unit tests for lib/db/queries/bookings.server.ts
 *
 * Tests the getNextBookingNumber function which generates sequential
 * BK-NNNN-XXXX booking reference numbers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db chain
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const dbMock = { select: mockSelect };

vi.mock("../../../../../lib/db/index", () => ({ db: dbMock }));

vi.mock("../../../../../lib/db/schema", () => ({
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

describe("getNextBookingNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns BK-1000-XXXX when no prior bookings exist", async () => {
    mockLimit.mockResolvedValue([]);
    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );
    const result = await getNextBookingNumber("org-1");
    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("increments the sequence number from the highest existing booking", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1005-A3KP" }]);
    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );
    const result = await getNextBookingNumber("org-1");
    expect(result).toMatch(/^BK-1006-[A-Z0-9]{4}$/);
  });

  it("falls back to BK-1000-XXXX when the booking number cannot be parsed", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-INVALID" }]);
    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );
    const result = await getNextBookingNumber("org-1");
    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("uses regexp_match (not SUBSTRING/POSITION) in the ORDER BY to prevent SQL errors", async () => {
    mockLimit.mockResolvedValue([]);
    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );
    await getNextBookingNumber("org-1");
    const orderByArg = mockOrderBy.mock.calls[0][0];
    const sqlStrings = orderByArg?.strings ?? [];
    const sqlText = Array.isArray(sqlStrings) ? sqlStrings.join("") : String(sqlStrings);
    expect(sqlText).toContain("regexp_match");
    expect(sqlText).not.toContain("SUBSTRING");
    expect(sqlText).not.toContain("POSITION");
  });
});
