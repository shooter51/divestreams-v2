/**
 * DS-m5in: Duplicate booking numbers — sequence not incrementing correctly
 * DS-8p6q: Updated for sequence table implementation
 *
 * Verifies that getNextBookingNumber correctly uses the sequence table for
 * atomic number allocation, and falls back to MAX scan on first use.
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

describe("DS-m5in: getNextBookingNumber — sequence increment fix", () => {
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

  it("returns BK-1008-XXXX via sequence when nextNumber=1009", async () => {
    // Sequence row: nextNumber=1009 (post-increment) → booking = 1008
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 1009 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("initialises sequence from max of existing bookings (BK-1007 → next is BK-1008)", async () => {
    // No sequence row, max existing is 1007
    mockSelectWhere.mockResolvedValue([{ maxNum: 1007 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1009 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("returns BK-1008-XXXX when mix of old-format and new-format bookings exist", async () => {
    // No sequence row; MAX returns 1007 (from existing BK-1007-ABCD)
    mockSelectWhere.mockResolvedValue([{ maxNum: 1007 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1009 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
  });

  it("returns BK-1000-XXXX when no bookings exist", async () => {
    // No sequence row, no existing bookings (maxNum=null)
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("returns BK-1000-XXXX when all booking numbers are unparseable", async () => {
    // MAX on parseable bookings returns null
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("works when a transaction dbInstance is passed", async () => {
    const txUpdateReturning = vi.fn().mockResolvedValue([{ nextNumber: 1009 }]);
    const txMock = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: txUpdateReturning,
          })),
        })),
      })),
    };

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1", txMock as any);

    expect(result).toMatch(/^BK-1008-[A-Z0-9]{4}$/);
    expect(txMock.update).toHaveBeenCalled();
  });

  it("output always matches BK-NNNN-XXXX format", async () => {
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 2502 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
    expect(result).toMatch(/^BK-2501-/);
  });
});
