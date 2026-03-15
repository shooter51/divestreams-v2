/**
 * Unit tests for lib/db/queries/bookings.server.ts
 *
 * DS-m5in: Duplicate booking numbers — sequence not incrementing correctly
 * DS-ktz5: Sequential BK-NNNN booking reference numbers
 * DS-45x1: Random suffix prevents prediction/enumeration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock shape: select().from().where() — terminal, no orderBy/limit chain
const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const dbMock = {
  select: mockSelect,
};

vi.mock("../../../../../lib/db/index", () => ({
  db: dbMock,
}));

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
    vi.resetAllMocks();
    vi.resetModules();
    mockWhere.mockResolvedValue([]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns BK-1000-XXXX when no bookings exist for the org", async () => {
    mockWhere.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns next sequential number after the highest existing booking", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-1005-ABCD" }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1006-[A-Z0-9]{4}$/);
  });

  it("returns BK-1008-XXXX when bookings BK-1000..BK-1007 exist (DS-m5in regression)", async () => {
    mockWhere.mockResolvedValue([
      { bookingNumber: "BK-1000" },
      { bookingNumber: "BK-1001" },
      { bookingNumber: "BK-1002" },
      { bookingNumber: "BK-1003" },
      { bookingNumber: "BK-1004" },
      { bookingNumber: "BK-1005" },
      { bookingNumber: "BK-1006" },
      { bookingNumber: "BK-1007" },
    ]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("picks the highest number from an unordered result set", async () => {
    mockWhere.mockResolvedValue([
      { bookingNumber: "BK-1003-XYZQ" },
      { bookingNumber: "BK-1007-ABCD" },
      { bookingNumber: "BK-1001-EFGH" },
    ]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("falls back to BK-1000-XXXX when existing booking number cannot be parsed", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-INVALID" }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("produces BK-NNNN-XXXX format output", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-1007-ABCD" }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("DS-45x1: generates unique suffixes across multiple calls", async () => {
    mockWhere.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
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

  it("uses the provided transaction dbInstance instead of module-level db", async () => {
    const txWhere = vi.fn().mockResolvedValue([{ bookingNumber: "BK-1007-ZZZZ" }]);
    const txFrom = vi.fn(() => ({ where: txWhere }));
    const txSelect = vi.fn(() => ({ from: txFrom }));
    const txMock = { select: txSelect };

    mockSelect.mockImplementation(() => {
      throw new Error("db.select called instead of tx.select");
    });

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getNextBookingNumber("org-1", txMock as any);

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
    expect(txSelect).toHaveBeenCalled();
  });
});
