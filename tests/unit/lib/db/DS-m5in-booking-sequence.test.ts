/**
 * DS-m5in: Duplicate booking numbers — sequence not incrementing correctly
 *
 * Verifies that getNextBookingNumber correctly finds the MAX booking number
 * across ALL existing bookings (not just the first result of an ordered query),
 * and that the fix works when called inside a transaction context.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock shape: select().from().where() — no orderBy/limit chain
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

describe("DS-m5in: getNextBookingNumber — sequence increment fix", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    // Restore default mock chain after resetAllMocks clears implementations
    mockWhere.mockResolvedValue([]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns BK-1008-XXXX when existing bookings include BK-1000 through BK-1007", async () => {
    // Simulates the real DB state described in the defect: BK-1000..BK-1007
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
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("returns BK-1008-XXXX when mix of old-format (BK-NNNN) and new-format (BK-NNNN-XXXX) bookings exist", async () => {
    // Mix of old format (no suffix) and new format (with suffix)
    mockWhere.mockResolvedValue([
      { bookingNumber: "BK-1000" },
      { bookingNumber: "BK-1001-A3KP" },
      { bookingNumber: "BK-1005-R7TZ" },
      { bookingNumber: "BK-1007" },
    ]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("picks the highest number from an unordered result set", async () => {
    // Results returned in arbitrary (non-sequential) order — the JS max-finding
    // must still find the correct highest value
    mockWhere.mockResolvedValue([
      { bookingNumber: "BK-1003-XYZQ" },
      { bookingNumber: "BK-1007-ABCD" },
      { bookingNumber: "BK-1001-EFGH" },
    ]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("returns BK-1000-XXXX when no bookings exist", async () => {
    mockWhere.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns BK-1000-XXXX when all booking numbers are unparseable", async () => {
    mockWhere.mockResolvedValue([
      { bookingNumber: "LEGACY-001" },
      { bookingNumber: null },
      { bookingNumber: "BK-INVALID" },
    ]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("works when a transaction dbInstance is passed (does not default to module-level db)", async () => {
    // Simulate tx being passed as dbInstance — the function must use it
    const txWhere = vi.fn().mockResolvedValue([{ bookingNumber: "BK-1007-ZZZZ" }]);
    const txFrom = vi.fn(() => ({ where: txWhere }));
    const txSelect = vi.fn(() => ({ from: txFrom }));
    const txMock = { select: txSelect };

    // dbMock.select should NOT be called when tx is passed
    mockSelect.mockImplementation(() => {
      throw new Error("db.select called instead of tx.select");
    });

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getNextBookingNumber("org-1", txMock as any);

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
    expect(txSelect).toHaveBeenCalled();
  });

  it("output always matches BK-NNNN-XXXX format", async () => {
    mockWhere.mockResolvedValue([{ bookingNumber: "BK-2500-QRST" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
    expect(result).toMatch(/^BK-2501-/);
  });
});
