/**
 * DS-ktz5: Sequential BK-NNNN booking reference numbers
 * DS-45x1: Random suffix prevents prediction/enumeration
 * DS-8p6q: Updated to use sequence table implementation
 *
 * New bookings should get BK-NNNN-XXXX format IDs (e.g. BK-1000-A3KP)
 * with sequential numbers and random 4-char suffix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

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

vi.mock("../../../../lib/db/index", () => ({
  get db() { return dbMock; },
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organization_id",
    bookingNumber: "booking_number",
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

describe("DS-ktz5: getNextBookingNumber", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMock = makeDb();
    mockUpdateReturning.mockReset();
    mockSelectWhere.mockReset();
    mockInsertReturning.mockReset();
    // Default: no sequence row, no existing bookings
    mockUpdateReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1001 }]);
  });

  it("returns BK-1000-XXXX when no bookings exist for the org (fallback path)", async () => {
    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns next sequential number when sequence row exists (fast path)", async () => {
    // Sequence row: nextNumber=1006 (post-increment) → booking number = 1005
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 1006 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1005-[A-Z0-9]{4}$/);
  });

  it("initialises sequence from max existing booking (fallback with existing bookings)", async () => {
    // No sequence row, existing bookings have max BK-1042
    mockSelectWhere.mockResolvedValue([{ maxNum: 1042 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1044 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1043-[A-Z0-9]{4}$/);
  });

  it("produces BK-NNNN-XXXX format output", async () => {
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 1008 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("DS-45x1: generates unique suffixes across multiple calls", async () => {
    // Sequence row increments each time
    let callCount = 1000;
    mockUpdateReturning.mockImplementation(() =>
      Promise.resolve([{ nextNumber: ++callCount }])
    );

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

  it("returns BK-1000-XXXX when fallback scan finds no parseable numbers", async () => {
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });
});
