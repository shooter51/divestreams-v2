/**
 * DS-ktz5: Sequential BK-NNNN booking reference numbers
 * DS-45x1: Random suffix prevents prediction/enumeration
 *
 * New bookings should get BK-NNNN-XXXX format IDs (e.g. BK-1000-A3KP)
 * with sequential numbers and random 4-char suffix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db — new implementation ends at .where(), no orderBy/limit
const mockWhere = vi.fn();
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

describe("DS-ktz5: getNextBookingNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns BK-1000-XXXX when no bookings exist for the org", async () => {
    mockWhere.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns next sequential number after the highest existing booking", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-1005-ABCD" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1006-[A-Z0-9]{4}$/);
  });

  it("returns BK-1001-XXXX when only BK-1000 exists", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-1000-XYZQ" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1001-[A-Z0-9]{4}$/);
  });

  it("produces BK-NNNN-XXXX format output", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-1007-ABCD" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when existing booking number cannot be parsed", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-INVALID" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("DS-45x1: generates unique suffixes across multiple calls", async () => {
    mockWhere.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = await getNextBookingNumber("org-1");
      results.add(result);
    }

    // With 4 random chars from 31-char alphabet (31^4 = ~923k combos),
    // 10 calls should produce at least 2 unique values
    expect(results.size).toBeGreaterThanOrEqual(2);
  });
});
