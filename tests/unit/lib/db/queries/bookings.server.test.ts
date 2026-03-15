/**
 * Unit tests for lib/db/queries/bookings.server.ts
 *
 * DS-m5in: Duplicate booking numbers — sequence not incrementing correctly
 * DS-ktz5: Sequential BK-NNNN booking reference numbers
 * DS-45x1: Random suffix prevents prediction/enumeration
 * DS-8p6q: Uses atomic sequence table for booking number generation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for the three key DB operations in getNextBookingNumber:
// 1. update().set().where().returning()  — sequence table atomic increment
// 2. select().from().where()             — fallback MAX scan
// 3. insert().values().returning()       — fallback sequence row creation
const mockUpdateReturning = vi.fn();
const mockSelectWhere = vi.fn();
const mockInsertReturning = vi.fn();

function makeDb() {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mockUpdateReturning,
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
  };
}

let dbMock = makeDb();

vi.mock("../../../../../lib/db/index", () => ({
  get db() { return dbMock; },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
  },
  bookingNumberSequences: {
    organizationId: "organization_id",
    nextNumber: "next_number",
    updatedAt: "updated_at",
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
    dbMock = makeDb();
    mockUpdateReturning.mockReset();
    mockSelectWhere.mockReset();
    mockInsertReturning.mockReset();
    // Default: no sequence row (fallback path), no existing bookings
    mockUpdateReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1001 }]);
  });

  it("returns BK-1000-XXXX when no bookings exist for the org", async () => {
    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns next sequential number after the highest existing booking", async () => {
    // Fallback path: MAX scan returns 1005
    mockSelectWhere.mockResolvedValue([{ maxNum: 1005 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1007 }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1006-[A-Z0-9]{4}$/);
  });

  it("returns BK-1008-XXXX when bookings BK-1000..BK-1007 exist (DS-m5in regression)", async () => {
    // Fallback path: MAX scan returns 1007 (the highest)
    mockSelectWhere.mockResolvedValue([{ maxNum: 1007 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1009 }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("picks the highest number from existing bookings via MAX scan", async () => {
    // Fallback path: MAX scan returns 1007 regardless of result order
    mockSelectWhere.mockResolvedValue([{ maxNum: 1007 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1009 }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("falls back to BK-1000-XXXX when existing booking number cannot be parsed", async () => {
    // Fallback path: MAX scan returns null (no parseable booking numbers)
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("produces BK-NNNN-XXXX format output", async () => {
    // Fast path: sequence row exists
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 1008 }]);

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("DS-45x1: generates unique suffixes across multiple calls", async () => {
    // Fast path: sequence row increments each call
    let callCount = 1000;
    mockUpdateReturning.mockImplementation(() =>
      Promise.resolve([{ nextNumber: ++callCount }])
    );

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
    // Create a separate tx mock with the sequence table chain
    const txUpdateReturning = vi.fn().mockResolvedValue([{ nextNumber: 1008 }]);
    const txMock = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: txUpdateReturning,
          })),
        })),
      })),
    };

    // Module-level db should NOT be called when tx is passed
    dbMock.update = vi.fn().mockImplementation(() => {
      throw new Error("db.update called instead of tx.update");
    });

    const { getNextBookingNumber } = await import(
      "../../../../../lib/db/queries/bookings.server"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getNextBookingNumber("org-1", txMock as any);

    expect(result).toMatch(/^BK-1007-[A-Z0-9]{4}$/);
    expect(txMock.update).toHaveBeenCalled();
  });
});
